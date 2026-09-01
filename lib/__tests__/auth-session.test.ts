// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";
import { jwtVerify } from "jose";
import { createSessionToken } from "@/lib/auth";

const SECRET = "test-secret-at-least-32-chars-long-xxxxx";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("createSessionToken", () => {
  it("includes token_version in the JWT payload", async () => {
    vi.stubEnv("SESSION_SECRET", SECRET);
    const token = await createSessionToken({ sub: "user-1", email: "a@b.com", tokenVersion: 3 });
    const { payload } = await jwtVerify(token, new TextEncoder().encode(SECRET), { algorithms: ["HS256"] });
    expect(payload.sub).toBe("user-1");
    expect(payload.email).toBe("a@b.com");
    expect(payload.token_version).toBe(3);
  });
});
