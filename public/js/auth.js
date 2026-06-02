import { doc, getDoc, updateDoc, collection, getDocs } from "./firestore-compat.js";
import { db } from "./firebase-config.js";

let cachedUser = null;
let authBootstrapPromise = null;
const authListeners = new Set();

async function readJson(response) {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload?.error?.code || payload?.message || "Request failed");
    error.code = payload?.error?.code || "unknown";
    error.details = payload?.error?.details;
    throw error;
  }

  return payload;
}

function normalizeUser(user) {
  if (!user) {
    return null;
  }

  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName || (user.email ? user.email.split("@")[0] : "User")
  };
}

function notifyAuthListeners() {
  authListeners.forEach((callback) => {
    try {
      callback(cachedUser);
    } catch (error) {
      console.error("Auth listener error:", error);
    }
  });
}

async function bootstrapAuthState() {
  const response = await fetch("/api/auth/me", {
    credentials: "include",
    cache: "no-store"
  });
  const payload = await readJson(response);
  cachedUser = normalizeUser(payload.user);
  notifyAuthListeners();
  return cachedUser;
}

function ensureAuthBootstrap() {
  if (!authBootstrapPromise) {
    authBootstrapPromise = bootstrapAuthState().catch((error) => {
      cachedUser = null;
      notifyAuthListeners();
      throw error;
    });
  }

  return authBootstrapPromise;
}

export async function signUp(email, password, displayName = null) {
  try {
    const requestBody = {
      email,
      password
    };

    if (typeof displayName === "string" && displayName.trim()) {
      requestBody.displayName = displayName.trim();
    }

    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "include",
      body: JSON.stringify(requestBody)
    });

    const payload = await readJson(response);
    cachedUser = normalizeUser(payload.user);
    notifyAuthListeners();

    return { success: true, user: cachedUser };
  } catch (error) {
    console.error("Sign up error:", error);
    const errorMessage = error.code || error.message || "Failed to create profile";
    return { success: false, error: errorMessage };
  }
}

export async function signIn(email, password) {
  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "include",
      body: JSON.stringify({
        email,
        password
      })
    });

    const payload = await readJson(response);
    cachedUser = normalizeUser(payload.user);
    notifyAuthListeners();

    return { success: true, user: cachedUser };
  } catch (error) {
    console.error("Sign in error:", error);
    return { success: false, error };
  }
}

export async function logOut() {
  try {
    const response = await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include"
    });

    await readJson(response);
    cachedUser = null;
    authBootstrapPromise = Promise.resolve(null);
    notifyAuthListeners();

    return { success: true };
  } catch (error) {
    console.error("Sign out error:", error);
    return { success: false, error: error.message };
  }
}

export function getCurrentUser() {
  return cachedUser;
}

export function onAuthChange(callback) {
  authListeners.add(callback);
  ensureAuthBootstrap()
    .then(() => callback(cachedUser))
    .catch(() => callback(null));

  return () => {
    authListeners.delete(callback);
  };
}

export async function getUserProfile(userId) {
  try {
    if (!userId) {
      return { success: false, error: "User ID is required" };
    }

    await ensureAuthBootstrap();
    const userDoc = await getDoc(doc(db, "users", userId));

    if (userDoc.exists()) {
      return { success: true, data: userDoc.data() };
    }

    return { success: false, error: "User profile not found" };
  } catch (error) {
    console.error("Get user profile error:", error);
    return { success: false, error: error.message };
  }
}

export async function updateUserProfile(userId, updates) {
  try {
    if (!userId) {
      return { success: false, error: "User ID is required" };
    }
    if (!updates || typeof updates !== "object") {
      return { success: false, error: "Updates must be an object" };
    }

    await ensureAuthBootstrap();
    await updateDoc(doc(db, "users", userId), updates);
    return { success: true };
  } catch (error) {
    console.error("Update user profile error:", error);
    return { success: false, error: error.message };
  }
}

export async function getAllUsers() {
  try {
    await ensureAuthBootstrap();
    const usersRef = collection(db, "users");
    const querySnapshot = await getDocs(usersRef);

    const users = [];
    querySnapshot.forEach((entry) => {
      const userData = entry.data();
      users.push({
        id: entry.id,
        ...userData
      });
    });

    return { success: true, data: users };
  } catch (error) {
    console.error("Get all users error:", error);
    return { success: false, error: error.message };
  }
}
