import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword, setSessionCookie } from "@/lib/auth";
import { sql } from "@/lib/db";

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(128),
  displayName: z.string().trim().min(1).max(50).nullable().optional()
});

function buildInitialProfile(email: string, displayName?: string) {
  const createdAt = new Date().toISOString();
  const finalDisplayName = displayName?.trim() || email.split("@")[0];

  return {
    email,
    displayName: finalDisplayName,
    xp: 0,
    ecoPoints: 0,
    level: 1,
    badges: [],
    missionsCompleted: 0,
    completedQuests: [],
    lastQuestResetTime: createdAt,
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
    createdAt
  };
}

export async function POST(request: Request) {
  try {
    const payload = signUpSchema.parse(await request.json());
    const email = payload.email.trim().toLowerCase();

    const existing = await sql("select id from users where email = $1 limit 1", [email]);
    if (existing.rowCount) {
      return NextResponse.json(
        { error: { code: "auth/email-already-in-use", message: "This email is already in use. Try logging in instead." } },
        { status: 400 }
      );
    }

    const userId = randomUUID();
    const passwordHash = await hashPassword(payload.password);
    const profile = buildInitialProfile(email, payload.displayName ?? undefined);

    try {
      await sql(
        "insert into users (id, email, password_hash, payload) values ($1, $2, $3, $4::jsonb)",
        [userId, email, passwordHash, JSON.stringify(profile)]
      );
    } catch (dbError: any) {
      console.error("Database error during signup:", dbError);
      
      const isUniqueViolation = 
        dbError.code === "23505" || 
        String(dbError.message || "").toLowerCase().includes("unique constraint") ||
        String(dbError.message || "").toLowerCase().includes("already exists");
        
      if (isUniqueViolation) {
        return NextResponse.json(
          { error: { code: "auth/email-already-in-use", message: "This email is already in use. Try logging in instead." } },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: { code: "auth/database-error", message: `Failed to create user profile: ${dbError.message || dbError}` } },
        { status: 500 }
      );
    }

    await setSessionCookie({
      sub: userId,
      email
    });

    return NextResponse.json({
      user: {
        uid: userId,
        email,
        displayName: profile.displayName
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "auth/invalid-input", details: error.flatten() } },
        { status: 400 }
      );
    }
    
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: { code: "auth/invalid-json", message: "Invalid JSON payload" } },
        { status: 400 }
      );
    }

    console.error("Signup error details:", error);
    return NextResponse.json(
      { error: { code: "auth/internal-error", message: error instanceof Error ? error.message : String(error) } },
      { status: 500 }
    );
  }
}
