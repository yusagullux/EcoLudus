import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";
import { getAuth, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyC52G-pG-QPY0JDxFRADxb2EXXwPyXTUGc",
  authDomain: "ecoludus-9332a.firebaseapp.com",
  projectId: "ecoludus-9332a",
  storageBucket: "ecoludus-9332a.firebasestorage.app",
  messagingSenderId: "9456851024",
  appId: "1:9456851024:web:c01b6bef0fbf4f7ce61955",
  measurementId: "G-QEMD4CHE5S"
};

const app = initializeApp(firebaseConfig);

let analytics;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}

const auth = getAuth(app);

// Set authentication persistence to LOCAL
// User stays logged in even after closing the browser
// User is only logged out when clicking "Sign Out" button
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.error("Error setting auth persistence:", error);
  });
}

const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage, analytics };

