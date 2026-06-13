"use client";

const REMEMBERED_SESSION_KEY = "ecoludus.rememberedSession";

type RememberedSession = {
  user: {
    uid: string;
    email: string;
    displayName: string;
  };
  savedAt: string;
};

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getRememberedSession(): RememberedSession | null {
  if (!canUseStorage()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(REMEMBERED_SESSION_KEY);
    return raw ? (JSON.parse(raw) as RememberedSession) : null;
  } catch {
    window.localStorage.removeItem(REMEMBERED_SESSION_KEY);
    return null;
  }
}

export function saveRememberedSession(user: RememberedSession["user"]) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(
    REMEMBERED_SESSION_KEY,
    JSON.stringify({
      user,
      savedAt: new Date().toISOString()
    })
  );
}

export function clearRememberedSession() {
  if (canUseStorage()) {
    window.localStorage.removeItem(REMEMBERED_SESSION_KEY);
  }
}
