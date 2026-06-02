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

    const message = error instanceof Error ? error.message : "internal-error";
    const status =
      message === "auth/unauthenticated" ? 401 : message === "permission-denied" ? 403 : 500;

    return NextResponse.json({ error: { code: message } }, { status });
  }
}
