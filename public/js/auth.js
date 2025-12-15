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
// See oli esimene keeruline osa - alguses ei mõistnud, kuidas Firebase töötab
// Vaatasin YouTube'i videoid ja Firebase dokumentatsiooni
// Esimesel katsel proovisin ilma async/await'ita, aga see ei töötanud
export async function signUp(email, password, displayName = null) {
  try {
    // loob Firebase autentimise kasutaja
    // await on vajalik, sest Firebase võtab aega
    // Esimesel katsel unustasin await'i ja sain Promise objekti tagasi
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const newUser = userCredential.user;
    // tagab, et kuvatav nimi on alati olemas
    // || tähendab "või" - kui displayName puudub, siis kasutan e-posti esimest osa
    // Esimesel katsel proovisin lihtsalt displayName, aga see andis vea, kui see oli null
    const userDisplayName = displayName || newUser.email.split("@")[0];
    // Salvestan kuupäeva ISO formaadis
    // Alguses proovisin lihtsalt new Date(), aga see ei töötanud Firestore'is hästi
    const accountCreationTime = new Date().toISOString();
    
    // loob kasutaja profiili Firestore'is, kõik väljad peavad olema algväärtustatud
    // See on pikk objekt, aga see on vajalik, et kõik andmed oleksid olemas
    // Esimesel katsel proovisin salvestada ainult email'i, aga siis sain vea, kui proovisin lugeda teisi väljasid
    // Õppisin, et Firestore vajab, et kõik väljad oleksid määratletud
    await setDoc(doc(db, "users", newUser.uid), {
      email: newUser.email,
      displayName: userDisplayName,
      // Algväärtused ning kõik algavad nullist
      // Esimesel katsel proovisin undefined, aga see ei töötanud
      xp: INITIAL_XP,
      ecoPoints: INITIAL_ECO_POINTS,
      level: INITIAL_LEVEL,
      // Tühjad massiivid ja objektid
      // Esimesel katsel proovisin null, aga siis ei saanud push() kasutada
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

// Kasutaja sisselogimine
// See on lihtsam kui signUp, aga alguses oli ka raske
// Esimesel katsel proovisin ilma try-catch'ita, aga siis sain vea, kui parool oli vale
export async function signIn(email, password) {
  try {
    // await on vajalik, sest Firebase võtab aega
    // Esimesel katsel unustasin await'i
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { success: true, user: userCredential.user };
  } catch (error) {
    // Logi viga konsooli, et näha, mis läks valesti
    // Esimesel katsel proovisin lihtsalt return false, aga siis ei teadnud, mis viga oli
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
// Alguses proovisin lihtsalt getDoc() ilma kontrollimata, aga see andis vea, kui profiil puudus
// Õppisin, et pean alati kontrollima, kas dokument on olemas
export async function getUserProfile(userId) {
  try {
    // kontrollib, et userId on olemas
    // Esimesel katsel unustasin seda kontrollida ja sain vea
    if (!userId) {
      return { success: false, error: "User ID is required" };
    }
    
    // getDoc() loeb dokumendi Firestore'ist
    // Esimesel katsel proovisin collection().get(), aga see oli liiga keeruline
    const userDoc = await getDoc(doc(db, "users", userId));
    // kontrollib, et dokument on olemas enne andmete tagastamist
    // exists() meetod kontrollib, kas dokument on olemas
    // Esimesel katsel proovisin lihtsalt userDoc.data(), aga see andis undefined, kui dokument puudus
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

