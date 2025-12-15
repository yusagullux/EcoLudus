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

// kasutaja registreerimine, loob uue kasutaja ja tema profiili andmebaasis
export async function signUp(email, password, displayName = null) {
  try {
    // loob Firebase autentimise kasutaja
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const newUser = userCredential.user;
    // tagab, et kuvatav nimi on alati olemas
    const userDisplayName = displayName || newUser.email.split("@")[0];
    const accountCreationTime = new Date().toISOString();
    
    // loob kasutaja profiili Firestore'is, kõik väljad peavad olema algväärtustatud
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
    // logib vea ja tagastab kasutajasõbraliku veateate
    console.error("Sign up error:", error);
    const errorMessage = error.code || error.message || "Failed to create account";
    return { success: false, error: errorMessage };
  }
}

export async function signIn(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { success: true, user: userCredential.user };
  } catch (error) {
    console.error("Sign in error:", error);
    return { success: false, error: error };
  }
}

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

// kasutaja profiili laadimine, kontrollib et profiil on olemas enne tagastamist
export async function getUserProfile(userId) {
  try {
    // kontrollib, et userId on olemas
    if (!userId) {
      return { success: false, error: "User ID is required" };
    }
    
    const userDoc = await getDoc(doc(db, "users", userId));
    // kontrollib, et dokument on olemas enne andmete tagastamist
    if (userDoc.exists()) {
      return { success: true, data: userDoc.data() };
    } else {
      return { success: false, error: "User profile not found" };
    }
  } catch (error) {
    // logib vea
    console.error("Get user profile error:", error);
    return { success: false, error: error.message };
  }
}

// kasutaja profiili uuendamine, kontrollib andmete kehtivust enne uuendamist
export async function updateUserProfile(userId, updates) {
  try {
    // kontrollib, et userId ja updates on olemas
    if (!userId) {
      return { success: false, error: "User ID is required" };
    }
    if (!updates || typeof updates !== 'object') {
      return { success: false, error: "Updates must be an object" };
    }
    
    await updateDoc(doc(db, "users", userId), updates);
    return { success: true };
  } catch (error) {
    // logib vea
    console.error("Update user profile error:", error);
    return { success: false, error: error.message };
  }
}

// kõikide kasutajate laadimine, kasutatakse leaderboard'is, võib ebaõnnestuda õiguste tõttu
export async function getAllUsers() {
  try {
    const usersRef = collection(db, "users");
    // sorteerib kasutajad XP järgi kahanevalt
    const q = query(usersRef, orderBy("xp", "desc"));
    const querySnapshot = await getDocs(q);
    
    const users = [];
    // loob kasutajate massiivi koos nende ID-dega
    querySnapshot.forEach((doc) => {
      const userData = doc.data();
      users.push({
        id: doc.id,
        ...userData
      });
    });
    
    return { success: true, data: users };
  } catch (error) {
    // logib vea, võib olla õiguste probleem Firestore reeglites
    console.error("Get all users error:", error);
    return { success: false, error: error.message };
  }
}

