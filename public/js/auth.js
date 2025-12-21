import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { auth, db } from "./firebase-config.js";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const INITIAL_XP = 0;
const INITIAL_ECO_POINTS = 0;
const INITIAL_LEVEL = 1;

// Registreerib uue kasutaja ja loob andmebaasi profiili
export async function signUp(email, password, displayName = null) {
  try {
    // Loob Firebase autentimise kasutaja
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const newUser = userCredential.user;

    // Tagab kuvatava nime olemasolu
    const userDisplayName = displayName || newUser.email.split("@")[0];
    const accountCreationTime = new Date().toISOString();

    // Loob Firestore profiili algväärtustega
    await setDoc(doc(db, "users", newUser.uid), {
      email: newUser.email,
      displayName: userDisplayName,
      xp: INITIAL_XP,
      ecoPoints: INITIAL_ECO_POINTS,
      level: INITIAL_LEVEL,
      badges: [],
      missionsCompleted: 0,
      completedQuests: [],
      lastQuestResetTime: accountCreationTime,
      currentDailyQuests: [],
      dailyQuestsCompleted: [],
      questCompletionCount: {},
      dailyQuestCompletions: {},
      lastQuestCompletionTime: null,
      plants: [],
      hatchings: [],
      animals: [],
      activePet: null,
      bestRank: null,
      allQuestsCompleted: false,
      allQuestsCompletedCount: 0,
      allQuestsCompletedDate: null,
      teamId: null,
      teamRole: null,
      teamStats: {
        missionsCompleted: 0,
        xpEarned: 0,
        ecoEarned: 0,
        approvalsGiven: 0
      },
      notificationPreferences: {
        dailyReminderEnabled: true,
        reminderHour: 9,
        teamUpdates: true,
        questTips: true
      },
      reminderMetadata: {
        lastReminderDate: null,
        pendingReminderId: null
      },
      insightSnapshots: [],
      createdAt: accountCreationTime
    });

    return { success: true, user: newUser };
  } catch (error) {
    console.error("Sign up error:", error);
    const errorMessage = error.code || error.message || "Failed to create account";
    return { success: false, error: errorMessage };
  }
}

// Kasutaja sisselogimine
export async function signIn(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { success: true, user: userCredential.user };
  } catch (error) {
    console.error("Sign in error:", error);
    return { success: false, error: error };
  }
}

// Kasutaja väljalogimine
export async function logOut() {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    console.error("Sign out error:", error);
    return { success: false, error: error.message };
  }
}

export function getCurrentUser() {
  return auth.currentUser;
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

// Laeb kasutaja profiili
export async function getUserProfile(userId) {
  try {
    if (!userId) {
      return { success: false, error: "User ID is required" };
    }

    const userDoc = await getDoc(doc(db, "users", userId));

    if (userDoc.exists()) {
      return { success: true, data: userDoc.data() };
    } else {
      return { success: false, error: "User profile not found" };
    }
  } catch (error) {
    console.error("Get user profile error:", error);
    return { success: false, error: error.message };
  }
}

// Uuendab kasutaja profiili
export async function updateUserProfile(userId, updates) {
  try {
    if (!userId) {
      return { success: false, error: "User ID is required" };
    }
    if (!updates || typeof updates !== 'object') {
      return { success: false, error: "Updates must be an object" };
    }

    await updateDoc(doc(db, "users", userId), updates);
    return { success: true };
  } catch (error) {
    console.error("Update user profile error:", error);
    return { success: false, error: error.message };
  }
}

// Laeb kõik kasutajad (nt edetabeli jaoks)
export async function getAllUsers() {
  try {
    const usersRef = collection(db, "users");
    // Sorteerib kasutajad XP järgi
    const q = query(usersRef, orderBy("xp", "desc"));
    const querySnapshot = await getDocs(q);

    const users = [];
    querySnapshot.forEach((doc) => {
      const userData = doc.data();
      users.push({
        id: doc.id,
        ...userData
      });
    });

    return { success: true, data: users };
  } catch (error) {
    console.error("Get all users error:", error);
    return { success: false, error: error.message };
  }
}
