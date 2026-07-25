import { describe, it, expect, vi } from "vitest";

// Stub the db module so importing photo-verification does not trigger any
// Postgres/file-store setup at test time. Only the pure helpers are exercised.
vi.mock("../db", () => ({
  sql: vi.fn(),
  transaction: vi.fn()
}));

import {
  isValidBase64ImagePayload,
  parsePhotoProof,
  MIN_PHOTO_BYTES,
  MAX_PHOTO_BYTES
} from "../photo-verification";

describe("isValidBase64ImagePayload", () => {
  it("accepts well-formed base64 with optional padding", () => {
    expect(isValidBase64ImagePayload("SGVsbG8=")).toBe(true);
    expect(isValidBase64ImagePayload("SGVsbG8gV29ybGQ=")).toBe(true);
  });

  it("rejects empty, non-base64, and bad length", () => {
    expect(isValidBase64ImagePayload("")).toBe(false);
    expect(isValidBase64ImagePayload("!!!not-base64!!!")).toBe(false);
    expect(isValidBase64ImagePayload("abc")).toBe(false); // length not multiple of 4
  });

  it("tolerates internal whitespace by stripping it", () => {
    expect(isValidBase64ImagePayload("SGVs bG8=")).toBe(true);
  });
});

describe("parsePhotoProof", () => {
  it("rejects non-string, empty, and too-short inputs", () => {
    expect(parsePhotoProof(undefined, "image/jpeg")).toBeNull();
    expect(parsePhotoProof(123, "image/jpeg")).toBeNull();
    expect(parsePhotoProof("x".repeat(50), "image/jpeg")).toBeNull(); // < 100 chars
  });

  it("rejects payloads outside the size limits", () => {
    // A long-enough base64 string that decodes under MIN_PHOTO_BYTES.
    const tiny = "A".repeat(200); // 200 chars, decodes to ~150 bytes < 5KB
    expect(parsePhotoProof(tiny, "image/png")).toBeNull();
  });

  it("parses a data: URL and returns the buffer + mime", () => {
    // Build a buffer just above MIN_PHOTO_BYTES and base64-encode it.
    const buffer = Buffer.alloc(MIN_PHOTO_BYTES + 100, 65); // 'A' bytes
    const b64 = buffer.toString("base64");
    const dataUrl = `data:image/png;base64,${b64}`;

    const result = parsePhotoProof(dataUrl, "image/jpeg");
    expect(result).not.toBeNull();
    expect(result?.mimeType).toBe("image/png"); // data-url mime wins
    expect(result?.buffer.length).toBe(buffer.length);
  });

  it("falls back to the caller mime when no data-url prefix", () => {
    const buffer = Buffer.alloc(MIN_PHOTO_BYTES + 100, 66);
    const b64 = buffer.toString("base64");

    const result = parsePhotoProof(b64, "image/webp");
    expect(result).not.toBeNull();
    expect(result?.mimeType).toBe("image/webp");
  });

  it("rejects payloads above MAX_PHOTO_BYTES", () => {
    const oversized = Buffer.alloc(MAX_PHOTO_BYTES + 1024, 67).toString("base64");
    expect(parsePhotoProof(oversized, "image/png")).toBeNull();
  });
});