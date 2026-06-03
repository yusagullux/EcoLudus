import { hashPassword, createSessionToken } from "../lib/auth";
import { sql } from "../lib/db";
import { randomUUID } from "crypto";

async function main() {
  process.env.SESSION_SECRET = "replace-with-a-long-random-secret";

  console.log("Starting test-auth...");
  try {
    const email = "test_auth_script_" + Date.now() + "@example.com";
    const password = "password123";

    console.log("Hashing password...");
    const passwordHash = await hashPassword(password);
    console.log("Hashed password:", passwordHash);

    const userId = randomUUID();
    const profile = {
      email,
      displayName: "Test User",
      xp: 0,
      ecoPoints: 0,
      level: 1,
      badges: [],
      missionsCompleted: 0,
      completedQuests: [],
      createdAt: new Date().toISOString()
    };

    console.log("Inserting user...");
    const insertRes = await sql(
      "insert into users (id, email, password_hash, payload) values ($1, $2, $3, $4::jsonb)",
      [userId, email, passwordHash, JSON.stringify(profile)]
    );
    console.log("Inserted user:", insertRes);

    console.log("Creating session token...");
    const token = await createSessionToken({ sub: userId, email });
    console.log("Session token created:", token);
  } catch (e: any) {
    console.error("Authentication test failed:", e);
  }
}

main();
