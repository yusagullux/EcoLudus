/**
 * Autentimise kontroll
 * Suunab automaatselt sisselogimislehele, kui kasutaja pole sisse logitud
 */
import { onAuthChange } from "./auth.js";

export function requireAuth() {
  return new Promise((resolve, reject) => {
    onAuthChange((user) => {
      if (user) {
        resolve(user);
      } else {
        // Suunab sisselogimislehele, kui kasutaja pole autenditud
        window.location.href = "login.html";
        reject(new Error("User not authenticated"));
      }
    });
  });
}

