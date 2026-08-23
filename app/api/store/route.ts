import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import {
  addDocument,
  deleteDocument,
  getDocument,
  listDocuments,
  setDocument,
  updateDocument
} from "@/lib/document-store";
import { rateLimit } from "@/lib/rate-limit";

const filterSchema = z.object({
  field: z.string(),
  op: z.literal("=="),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()])
});

const requestSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("getDoc"),
    path: z.array(z.string()).min(2)
  }),
  z.object({
    op: z.literal("setDoc"),
    path: z.array(z.string()).min(2),
    data: z.record(z.string(), z.unknown())
  }),
  z.object({
    op: z.literal("updateDoc"),
    path: z.array(z.string()).min(2),
    data: z.record(z.string(), z.unknown())
  }),
  z.object({
    op: z.literal("deleteDoc"),
    path: z.array(z.string()).min(2)
  }),
  z.object({
    op: z.literal("addDoc"),
    path: z.array(z.string()).min(1),
    data: z.record(z.string(), z.unknown())
  }),
  z.object({
    op: z.literal("getDocs"),
    path: z.array(z.string()).min(1),
    filters: z.array(filterSchema).default([]),
    limit: z.number().int().positive().max(500).nullable().optional()
  })
]);

export async function POST(request: Request) {
  const limit = rateLimit(request, "store-rpc", 120, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: { code: "rate-limit/exceeded", message: "Too many requests. Try again shortly." } },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  const session = await getSession();

  try {
    const payload = requestSchema.parse(await request.json());

    if (payload.op === "getDoc") {
      const data = await getDocument(payload.path, session);
      return NextResponse.json({ data });
    }

    if (payload.op === "setDoc") {
      await setDocument(payload.path, payload.data, session);
      return NextResponse.json({ success: true });
    }

    if (payload.op === "updateDoc") {
      await updateDocument(payload.path, payload.data, session);
      return NextResponse.json({ success: true });
    }

    if (payload.op === "deleteDoc") {
      await deleteDocument(payload.path, session);
      return NextResponse.json({ success: true });
    }

    if (payload.op === "addDoc") {
      const result = await addDocument(payload.path, payload.data, session);
      return NextResponse.json(result);
    }

    const data = await listDocuments(payload.path, payload.filters, payload.limit ?? null, session);
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "invalid-argument", details: error.flatten() } },
        { status: 400 }
      );
    }

    // Map only the known, app-thrown error strings to stable codes + statuses.
    // Anything else (including a raw `pg` error message bubbling up from sql())
    // falls back to a generic internal-error so we never surface Postgres
    // internals (table/column/constraint names) to the client.
    const appMessage = error instanceof Error ? error.message : "";
    const known: Record<string, { status: number; code: string }> = {
      "auth/unauthenticated": { status: 401, code: "auth/unauthenticated" },
      "permission-denied": { status: 403, code: "permission-denied" },
      "not-found": { status: 404, code: "not-found" }
    };
    const mapped = known[appMessage];
    const status = mapped?.status ?? 500;
    const code = mapped?.code ?? "internal-error";

    return NextResponse.json({ error: { code } }, { status });
  }
}
