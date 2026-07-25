import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getImpactSince } from "@/lib/impact-service";
import { buildWeeklyReportHtml, buildWeeklyReportText, type WeeklyReportData } from "@/lib/email-templates/weekly-report";
import { logger, logError } from "@/lib/logger";

/**
 * Weekly email cron — sends personalised impact reports every Monday at 08:00 UTC.
 * Configured in vercel.json. Secured with CRON_SECRET.
 *
 * Requires:
 *   SENDGRID_API_KEY  — SendGrid API key (free tier: 100 emails/day)
 *   SENDGRID_FROM     — verified sender address, e.g. "hello@ecoludus.com"
 *   CRON_SECRET       — shared secret to authenticate this endpoint
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sendgridKey = process.env.SENDGRID_API_KEY?.trim();
  const fromAddress = process.env.SENDGRID_FROM?.trim() || "hello@ecoludus.com";

  if (!sendgridKey) {
    return NextResponse.json(
      { error: "SENDGRID_API_KEY not configured — weekly emails skipped." },
      { status: 200 }
    );
  }

  try {
    // Load all users (respect email opt-out flag in payload)
    const usersResult = await sql<{
      id: string;
      email: string;
      payload: Record<string, unknown>;
    }>("select id, email, payload from users order by created_at asc limit $1", [500]);

    // Load global rank data once
    const allUsers = usersResult.rows.map((u) => ({
      id: u.id,
      xp: Number((u.payload as any)?.xp ?? 0)
    }));
    allUsers.sort((a, b) => b.xp - a.xp);
    const rankMap = new Map(allUsers.map((u, i) => [u.id, i + 1]));

    // Window for "this week" — trailing 7 days. Using a rolling window (rather
    // than calendar-week Monday 00:00) keeps the report correct even if the
    // cron fires late. impact_events is the server-authoritative spine ledger.
    const weekStartIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    let sent = 0;
    let skipped = 0;

    for (const user of usersResult.rows) {
      const payload = user.payload as Record<string, unknown>;

      // Respect opt-out
      if (payload?.emailWeeklyReport === false) {
        skipped++;
        continue;
      }

      const displayName =
        String(payload?.displayName ?? user.email.split("@")[0] ?? "Explorer");
      const xp = Number(payload?.xp ?? 0);
      const level = Number(payload?.level ?? 1);
      const carbonReduced = Number(payload?.carbonReduced ?? 0);
      const missionsCompleted = Number(payload?.missionsCompleted ?? 0);
      const treesPlanted = Number(payload?.treesPlanted ?? 0);

      // Estimate weekly missions from daily completion history
      const today = new Date();
      const dailyQuestCompletions = (payload?.dailyQuestCompletions ?? {}) as Record<string, string[]>;
      let weeklyMissions = 0;
      for (let d = 0; d < 7; d++) {
        const date = new Date(today);
        date.setDate(today.getDate() - d);
        const key = date.toISOString().slice(0, 10);
        weeklyMissions += dailyQuestCompletions[key]?.length ?? 0;
      }

      // Impact gained this week from the spine ledger. XP is only a running
      // total (users.xp), not separately ledgered, so the comprehensive
      // server-authoritative weekly-progress metric is Impact — the same one
      // the dashboard's "Impact this week" cell shows.
      const impactGainedThisWeek = await getImpactSince(user.id, weekStartIso);

      const reportData: WeeklyReportData = {
        displayName,
        email: user.email,
        xp,
        impactGainedThisWeek,
        level,
        carbonReduced,
        missionsCompleted,
        treesPlanted,
        rank: rankMap.get(user.id) ?? null,
        totalPlayers: allUsers.length,
        weeklyMissions
      };

      const html = buildWeeklyReportHtml(reportData);
      const text = buildWeeklyReportText(reportData);

      try {
        const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${sendgridKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            personalizations: [
              {
                to: [{ email: user.email, name: displayName }],
                subject: `Your EcoLudus week: +${impactGainedThisWeek} Impact earned`
              }
            ],
            from: { email: fromAddress, name: "EcoLudus" },
            content: [
              { type: "text/plain", value: text },
              { type: "text/html", value: html }
            ]
          })
        });

        if (response.ok || response.status === 202) {
          sent++;
        } else {
          const body = await response.text();
          logger.error("SendGrid send failed", { email: user.email, status: response.status, body: body.slice(0, 500) });
          skipped++;
        }
      } catch (err) {
        logError("Failed to send weekly report email", err, { email: user.email });
        skipped++;
      }
    }

    return NextResponse.json({
      success: true,
      sent,
      skipped,
      total: usersResult.rows.length,
      runAt: new Date().toISOString()
    });
  } catch (error) {
    logError("Weekly report cron error", error);
    return NextResponse.json(
      { error: { code: "internal-error" } },
      { status: 500 }
    );
  }
}

// Vercel Cron Jobs send GET requests
export async function GET(request: Request) {
  return POST(request);
}
