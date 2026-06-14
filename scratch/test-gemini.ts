import { verifyPrivateMissionSubmission } from "../lib/private-mission-verification";

// Load environment variables (mimicking Next.js loading .env.local)
import * as fs from "fs";
import * as path from "path";

function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, "utf-8");
    envFile.split("\n").forEach((line) => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || "";
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        } else if (value.startsWith("'") && value.endsWith("'")) {
          value = value.slice(1, -1);
        }
        process.env[key] = value.trim();
      }
    });
  }
}

loadEnv();

async function runTest() {
  console.log("GEMINI_API_KEY:", process.env.GEMINI_API_KEY ? "Found" : "Missing");
  console.log("GEMINI_MODEL:", process.env.GEMINI_MODEL);

  const testInput = {
    missionId: "recycling_2",
    userId: "00000000-0000-0000-0000-000000000000",
    beforeValue: "3 plastic bottles in the bin",
    afterValue: "0 plastic bottles left, bin is clean",
    description: "I collected three plastic bottles from my desk and threw them in the recycling bin.",
    confidence: 5,
    timestamp: new Date().toISOString(),
    userTrustScore: 75,
    recentSubmissions: []
  };

  try {
    const result = await verifyPrivateMissionSubmission(testInput);
    console.log("Verification Result:", JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Verification failed with error:", error);
  }
}

runTest();
