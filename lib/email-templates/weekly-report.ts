export type WeeklyReportData = {
  displayName: string;
  email: string;
  xp: number;
  xpGainedThisWeek: number;
  level: number;
  carbonReduced: number;
  missionsCompleted: number;
  treesPlanted: number;
  rank: number | null;
  totalPlayers: number;
  weeklyMissions: number;
};

export function buildWeeklyReportHtml(data: WeeklyReportData): string {
  const {
    displayName,
    xp,
    xpGainedThisWeek,
    level,
    carbonReduced,
    missionsCompleted,
    treesPlanted,
    rank,
    totalPlayers,
    weeklyMissions
  } = data;

  const rankText =
    rank !== null && totalPlayers > 0
      ? `#${rank} of ${totalPlayers} players`
      : "Not ranked yet";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your EcoLudus Weekly Report</title>
</head>
<body style="margin:0;padding:0;background:#f0f4e8;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4e8;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#102016;border-radius:20px 20px 0 0;padding:28px 32px;text-align:center;">
              <p style="margin:0;color:#8fbf7a;font-size:11px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;">EcoLudus</p>
              <h1 style="margin:8px 0 4px;color:#ffffff;font-size:26px;font-weight:700;">Your Weekly Impact</h1>
              <p style="margin:0;color:#8fbf7a;font-size:13px;">Great work, ${displayName} — here's what you achieved this week.</p>
            </td>
          </tr>

          <!-- XP highlight -->
          <tr>
            <td style="background:#1a3020;padding:20px 32px;text-align:center;">
              <p style="margin:0;color:#8fbf7a;font-size:11px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;">XP Gained This Week</p>
              <p style="margin:6px 0 0;color:#ffffff;font-size:42px;font-weight:700;line-height:1;">+${xpGainedThisWeek.toLocaleString()}</p>
              <p style="margin:4px 0 0;color:#8fbf7a;font-size:12px;">${xp.toLocaleString()} total XP · Level ${level}</p>
            </td>
          </tr>

          <!-- Stats grid -->
          <tr>
            <td style="background:#ffffff;padding:24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  ${[
                    { label: "Missions Done", value: `${weeklyMissions} this week`, icon: "✅" },
                    { label: "CO₂ Reduced", value: `${carbonReduced.toFixed(1)} kg total`, icon: "🌿" },
                    { label: "Trees Planted", value: `${treesPlanted} total`, icon: "🌳" },
                    { label: "Rank", value: rankText, icon: "🏆" }
                  ]
                    .map(
                      ({ label, value, icon }) =>
                        `<td width="25%" style="text-align:center;padding:12px 8px;vertical-align:top;">
                          <p style="margin:0;font-size:22px;">${icon}</p>
                          <p style="margin:6px 0 2px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.12em;color:#5a7a5a;">${label}</p>
                          <p style="margin:0;font-size:13px;font-weight:700;color:#102016;">${value}</p>
                        </td>`
                    )
                    .join("")}
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="background:#f7f9f2;padding:24px 32px;text-align:center;border-top:1px solid #e7ecdf;">
              <p style="margin:0 0 16px;font-size:14px;color:#3a5c3a;">Keep the momentum going — today's missions are waiting.</p>
              <a href="https://ecoludus.com/dashboard"
                 style="display:inline-block;background:#102016;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:100px;font-size:13px;font-weight:700;letter-spacing:0.06em;">
                Continue Your Journey →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f0f4e8;border-radius:0 0 20px 20px;padding:20px 32px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#6a8a6a;">You're receiving this because weekly reports are enabled for your account.</p>
              <p style="margin:6px 0 0;font-size:11px;color:#6a8a6a;">
                <a href="https://ecoludus.com/settings" style="color:#3a7a3a;">Manage email preferences</a>
                &nbsp;·&nbsp;
                <a href="https://ecoludus.com" style="color:#3a7a3a;">EcoLudus</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildWeeklyReportText(data: WeeklyReportData): string {
  return `EcoLudus — Your Weekly Impact Report

Hi ${data.displayName},

Here's your week in review:

  +${data.xpGainedThisWeek.toLocaleString()} XP this week (${data.xp.toLocaleString()} total · Level ${data.level})
  ✅ ${data.weeklyMissions} missions completed
  🌿 ${data.carbonReduced.toFixed(1)} kg CO₂ reduced total
  🌳 ${data.treesPlanted} trees planted
  🏆 Rank: ${data.rank !== null ? `#${data.rank} of ${data.totalPlayers}` : "not ranked yet"}

Keep going — your daily missions are ready at https://ecoludus.com/dashboard

Manage your email preferences: https://ecoludus.com/settings
`;
}
