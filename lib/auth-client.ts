"use client";

// Client-side auth/profile helpers. These talk to the app's Postgres-backed
// document-store RPC at /api/store (formerly the Firestore-compat endpoint) and
// the session endpoints under /api/auth. No Firebase/Firestore is involved.

type UserProfile = Record<string, unknown>;

type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };

const STORE_ENDPOINT = "/api/store";

async function readJson(response: Response) {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      (payload as any)?.error?.code || (payload as any)?.message || "Request failed"
    );
    (error as Error & { code?: string }).code = (payload as any)?.error?.code || "unknown";
    throw error;
  }

  return payload;
}

async function callStore(operation: Record<string, unknown>) {
  const response = await fetch(STORE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(operation)
  });

  return readJson(response);
}

export async function logOut() {
  try {
    const response = await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include"
    });

    await readJson(response);
    return { success: true } as const;
  } catch (error) {
    console.error("Sign out error:", error);
    return { success: false, error: (error as Error).message } as const;
  }
}

export async function updateUserProfile(
  userId: string,
  updates: Record<string, unknown>
): Promise<Result<true>> {
  try {
    if (!userId) {
      return { success: false, error: "User ID is required" };
    }
    if (!updates || typeof updates !== "object") {
      return { success: false, error: "Updates must be an object" };
    }

    await callStore({ op: "updateDoc", path: ["users", userId], data: updates });
    return { success: true, data: true };
  } catch (error) {
    console.error("Update user profile error:", error);
    return { success: false, error: (error as Error).message };
  }
}

export async function getAllUsers(): Promise<Result<Array<UserProfile & { id: string }>>> {
  try {
    const payload = await callStore({ op: "getDocs", path: ["users"] });
    const entries = ((payload as any)?.data ?? []) as Array<{ id: string; data: UserProfile }>;

    const users = entries.map((entry) => ({
      id: entry.id,
      ...(entry.data ?? {})
    }));

    return { success: true, data: users };
  } catch (error) {
    console.error("Get all users error:", error);
    return { success: false, error: (error as Error).message };
  }
}