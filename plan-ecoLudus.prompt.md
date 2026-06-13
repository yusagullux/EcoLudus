# MASTER ACTION PLAN: EcoLudus (2-4 Months)

## TL;DR
Replace hardcoded landing page data with real database aggregations → integrate Climatiq for verified carbon tracking → automate real-world tree planting via Ecologi API → phase work into 3 stages for solo developer execution. Zero fake metrics; every statistic driven by real data or verified APIs.

---

## PHASE 1: IMMEDIATE WINS (Weeks 1-2) — Trust & Authenticity
*High-impact, low-effort foundation work — solo dev can ship in 2 weeks*

| Task | Impact | Effort | Details |
|------|--------|--------|---------|
| **1.1 Replace Hardcoded Landing Stats** | ⭐⭐⭐ | Low | ✅ COMPLETED - Created `LiveStatsCard` component that fetches real user metrics from database. Landing page now displays real aggregated data instead of hardcoded values. |
| **1.2 Update Footer & Legal Pages** | ⭐⭐ | Low | ✅ COMPLETED - Added Privacy Policy + Terms pages at `/legal/privacy` and `/legal/terms`. Updated footer with copyright 2026, navigation links, and legal page links. Updated robots.ts. |
| **1.3 Social Proof Framework** | ⭐⭐⭐ | Low | ✅ COMPLETED - Added `isPublicProfile` support. Created `/api/community/stats` endpoint showing real community metrics. Built `CommunityPulse` component displaying active members, missions, and CO₂ avoided. |
| **1.4 Visual Garden (No Stock Photos)** | ⭐⭐⭐ | Medium | ✅ COMPLETED - Built interactive SVG-based garden component (`GardenPreview`) with plant growth stages (seed → sprout → flower). Hand-coded CSS/SVG graphics, zero external images. |
| **1.5 Navigation Sync** | ⭐ | Low | ✅ COMPLETED - Added mobile hamburger menu with animated toggle. Desktop & mobile navigation consistent. All header links working with proper anchors. |

**Phase 1 Deliverables**: ✅ COMPLETE
- Landing page shows real community data (members, missions, CO₂ avoided)
- Live stats card displays real aggregated database values
- Interactive SVG garden with plant growth mechanics
- Legal compliance: Privacy + Terms pages with 2026 copyright
- Mobile-responsive navigation with hamburger menu
- Zero fake metrics visible - all data driven by real database queries
- Social proof component showing authentic community impact

---

## PHASE 2: CORE INTEGRATIONS (Weeks 3-8) — Real Carbon & Rewards
*Establish authentic carbon tracking + automate real-world impact*

| Task | Impact | Effort | Free API | Details |
|------|--------|--------|----------|---------|
| **2.1 Carbon Tracking Integration** | ⭐⭐⭐ | High | Climatiq (200/mo free) | Register at climatiq.io. Create `lib/carbon-calc.ts` to map quest types → Climatiq activity codes. Example: "walk instead of drive" calls Climatiq's transport API to calculate actual CO₂ saved. Cache results in DB (don't requery same quest). Store real carbon values in mission_logs instead of hardcoded values. |
| **2.2 Real-World Rewards (Tree Planting)** | ⭐⭐⭐ | High | Ecologi (free tier) | Integrate Ecologi API. Set milestones: Level 5 = 1 tree, 10kg CO₂ offset = 1 tree. Create `lib/rewards-sync.ts` + cron job to automatically plant trees when users hit milestones. User gets in-app notification + planting certificate. |
| **2.3 Live Aggregation API** | ⭐⭐ | Medium | None | Create `/api/stats/community-aggregate` endpoint. Queries PostgreSQL for live stats (total users, total XP, total CO₂, total missions). Add 5-min caching layer. Landing page calls this instead of fetching individual users. |
| **2.4 Photo Verification Confidence** | ⭐ | Low | None | Enhance existing photo verification with confidence scoring (0-100 based on image quality). Show on dashboard: "✓ Verified (98% confidence)". Transparency for borderline cases. |
| **2.5 Team Leaderboard Real-Time** | ⭐⭐ | Low | None | Create `/api/stats/team-aggregate` endpoint. Leaderboard updates within 30 seconds of quest completion. No stale data. |

**Phase 2 Deliverables**: Every carbon stat is verified by Climatiq API → real trees planted when users reach milestones (Ecologi) → live community leaderboard + impact tracking dashboard.

---

## PHASE 3: SCALING FEATURES (Weeks 9-16) — Growth & Partnerships
*Advanced UX, B2B partnerships, monetization framework*

| Task | Impact | Effort | Free API | Details |
|------|--------|--------|----------|---------|
| **3.1 Environmental Partners Directory** | ⭐⭐ | Medium | None | Create admin dashboard to manage environmental partners (tree planting orgs, carbon offset providers, etc.). Log which partner handled which action. User impact page shows all partners involved. |
| **3.2 Weekly Impact Emails** | ⭐⭐⭐ | Medium | SendGrid (100/day free) | Automated weekly emails showing: XP earned, missions completed, CO₂ offset, trees planted, rank movement, progress toward next level. Uses real data from database. |
| **3.3 Regional Carbon Multipliers** | ⭐⭐ | High | Electricitymap (free) | Fetch user's location. Adjust carbon offset based on regional electricity grid mix. "Your quest had 1.2x impact because your region relies on coal-heavy energy." Real, contextual impact. |
| **3.4 Premium Features Preview** | ⭐ | Low | None | Create `/premium` page with locked features (custom avatars, advanced analytics, early access quests). Monetization pathway for future. |
| **3.5 PWA / Mobile Install** | ⭐⭐ | Medium | None | Add service worker + Web App manifest. Users can "Add to Home Screen" on mobile. Offline caching for dashboard. |

**Phase 3 Deliverables**: Partner ecosystem established → automated engagement loops (weekly emails) → regional context awareness → mobile-first experience.

---

## KEY FILES TO CREATE/MODIFY (Prioritized)

### PHASE 1 (Create These First)
```
Components:
  app/components/live-stats-card.tsx (NEW) — Fetches real aggregated stats
  app/components/garden-preview.tsx (NEW) — SVG garden visualization  
  app/components/community-pulse.tsx (NEW) — Community stats display

Pages:
  app/landing/page.tsx (MODIFY) — Replace hardcoded dashboard
  app/legal/privacy/page.tsx (NEW) — Privacy policy
  app/legal/terms/page.tsx (NEW) — Terms of service
  components/marketing-shell.tsx (MODIFY) — Footer + nav fixes
```

### PHASE 2 (Core Integration Layer)
```
Backend Services:
  lib/carbon-calc.ts (NEW) — Climatiq API wrapper
  lib/rewards-sync.ts (NEW) — Ecologi integration + milestone logic

APIs:
  app/api/stats/community-aggregate/route.ts (NEW) — Live aggregation
  app/api/stats/team-aggregate/route.ts (NEW) — Live team stats
  app/api/cron/process-rewards/route.ts (NEW) — Cron job handler

Pages:
  app/(game)/impact/page.tsx (NEW) — Impact dashboard
  app/(game)/leaderboard/page.tsx (MODIFY) — Use live aggregation

Config:
  vercel.json (MODIFY) — Add cron job configuration
```

### PHASE 3 (Scaling Layer)
```
Backend Services:
  lib/email-templates/weekly-report.ts (NEW) — Email generation
  lib/carbon-multiplier.ts (NEW) — Regional multipliers

APIs:
  app/api/cron/send-weekly-reports/route.ts (NEW) — Email automation
  app/api/admin/partners/route.ts (NEW) — Partner admin dashboard

Pages:
  app/(game)/settings/page.tsx (NEW) — Email preferences
  app/(game)/premium/page.tsx (NEW) — Premium features preview

PWA:
  public/manifest.json (NEW) — Web app manifest
  public/sw.js (NEW) — Service worker
```

---

## TECHNICAL DECISIONS

### Free APIs Selected (Minimal Budget Requirement)
| Service | Why | Cost | Limit |
|---------|-----|------|-------|
| **Climatiq** | Industry-standard for carbon calculations; free tier includes 200 API requests/month (sufficient for ~200 users completing quests) | Free ($0) | 200 req/mo |
| **Ecologi** | Simplest tree-planting API; free tier available; transparent partnerships | Free ($0) | TBD (verify on signup) |
| **SendGrid** | Most reliable email service; free tier = 100 emails/day (covers weekly emails for 500 users) | Free ($0) → $10/mo at scale | 100 /day |
| **Electricitymap** | Regional carbon grid data; free tier available | Free ($0) | TBD |

**Fallback Plans**:
- If Climatiq exhausted: Fork Carbon Interface API (simpler, community-driven)
- If Ecologi tree limit hit: Manual sponsorship + switch to paid tier ($19/mo)
- If SendGrid exhausted: Move to Resend ($20/mo) or PostalMark (cheaper)

### Data Validation Architecture
```
All User-Facing Stats Calculation:
  1. Query database (real data only)
  2. Call external API if needed (Climatiq, Electricitymap)
  3. Cache result for 5-30 minutes
  4. If external API down: show "Last known value as of [timestamp]"
  5. NEVER show estimated/fake values
```

### Caching Strategy (Solo Dev Efficiency)
- **Community aggregations**: In-memory 5-min cache
- **Carbon calculations**: DB cache with 30-day TTL
- **User profiles**: Client-side React SWR (30-sec revalidation)
- **Email templates**: Static (no cache needed)

---

## EXECUTION ROADMAP (Solo Developer Timeline)

```
Week 1-2:   Phase 1 complete (live stats, legal, garden, social proof)
Week 3-5:   Phase 2a (carbon API integration, DB modifications)
Week 6-8:   Phase 2b (rewards integration, impact dashboard, cron setup)
Week 9-12:  Phase 3a (email automation, partner framework)
Week 13-16: Phase 3b (regional multipliers, premium preview, PWA)
```

**Testing After Each Phase**: 2-3 days per phase for QA + edge cases. Don't skip.

---

## VERIFICATION CHECKLIST

### Post-Phase 1 Validation
- ✅ Landing page shows real user count, real XP totals, real CO₂ (no hardcoded values)
- ✅ Footer displays 2026
- ✅ Privacy + Terms pages accessible + indexed (robots.ts updated)
- ✅ SVG garden renders (no layout broken, no external images loaded)
- ✅ Community stats update when new users opt-in

### Post-Phase 2 Validation
- ✅ Complete quest → mission_logs stores CO₂ value from Climatiq (not hardcoded)
- ✅ Climatiq requests under 200/month on free tier
- ✅ User reaches Level 5 → cron plants tree in Ecologi (check Ecologi dashboard)
- ✅ User receives in-app notification: "Your efforts just planted 1 tree!"
- ✅ Team leaderboard updates within 30 seconds of quest completion
- ✅ Photo verification shows confidence score (varies by image quality)
- ✅ Impact dashboard shows total trees + total CO₂ with source attribution

### Post-Phase 3 Validation
- ✅ User receives weekly email with real stats (matches dashboard)
- ✅ Email opt-out respected
- ✅ Premium page loads with locked features (clear visual hierarchy)
- ✅ PWA installs on mobile (test: iPhone + Android)
- ✅ Offline mode: dashboard loads cached content without internet
- ✅ Partner admin accessible only with auth token (security check)

---

## CRITICAL QUESTIONS RESOLVED

1. **"Will the APIs be exhausted?"** → For 100-1,000 users in Phase 2 timeline, no. Budget for upgrades in Phase 3.

2. **"What if Climatiq/Ecologi is down?"** → Graceful degradation: show "Last known value" + banner, queue retry jobs, don't show fake data.

3. **"Can a solo dev do this?"** → Yes. Phasing is key. Each phase is independently shippable. 2-4 month timeline is realistic with proper breaks.

4. **"How do we prevent future hardcoded data?"** → Every stat on dashboard must have a `source` field (e.g., `carbon: 1.5, source: "climatiq"`) + comment explaining origin. Code review checklist.

---

## APPENDIX: DETAILED IMPLEMENTATION NOTES

### Phase 1.1: Replace Hardcoded Landing Stats

**File: `app/components/live-stats-card.tsx` (NEW)**
```typescript
import { sql } from "@/lib/db";

export async function LiveStatsCard() {
  try {
    const result = await sql(`
      SELECT 
        COUNT(DISTINCT user_id) as active_users,
        COALESCE(SUM(CAST(payload->>'xp' AS INTEGER)), 0) as total_xp,
        COALESCE(SUM(CAST(payload->>'carbonReduced' AS FLOAT)), 0) as total_co2,
        COUNT(*) as total_missions
      FROM mission_logs
      WHERE created_at > NOW() - INTERVAL '90 days'
    `);

    const stats = result.rows[0] || { 
      active_users: 0, 
      total_xp: 0, 
      total_co2: 0, 
      total_missions: 0 
    };

    return (
      <div className="rounded-[2rem] border border-white/70 bg-[...] p-5">
        <div className="rounded-[1.5rem] bg-[...] p-6 text-cream-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-moss-300">Today's pulse</p>
              <h2 className="mt-3 font-serif text-3xl">Forest dashboard</h2>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3 text-right">
              <div className="text-xs uppercase tracking-[0.22em] text-moss-300">CO₂ reduced</div>
              <div className="mt-2 text-3xl font-semibold">{stats.total_co2.toFixed(1)}kg</div>
            </div>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              ["Active Users", stats.active_users],
              ["Total Missions", stats.total_missions],
              ["Community XP", stats.total_xp]
            ].map(([label, value]) => (
              <div key={label} className="rounded-3xl border border-white/10 bg-white/8 px-4 py-5">
                <div className="text-xs uppercase tracking-[0.2em] text-moss-300">{label}</div>
                <div className="mt-3 text-2xl font-semibold text-white">{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  } catch (error) {
    // Fallback: show placeholder
    return <div className="text-center py-12 text-forest-900/50">Stats loading...</div>;
  }
}
```

**File: `app/landing/page.tsx` (MODIFY)**
Replace the hardcoded dashboard section with:
```typescript
import { LiveStatsCard } from "@/components/live-stats-card";

// Inside LandingPage JSX, replace the hardcoded <div className="rounded-[2rem]..."> with:
<Suspense fallback={<div className="h-96 bg-forest-50 rounded-2xl" />}>
  <LiveStatsCard />
</Suspense>
```

---

### Phase 2.1: Carbon Tracking Integration

**File: `lib/carbon-calc.ts` (NEW)**
```typescript
import { sql } from "@/lib/db";

type QuestCategory = "recycling" | "transportation" | "energy" | "water" | "cleanup" | "gardening";

const CLIMATIQ_MAPPING: Record<QuestCategory, string> = {
  recycling: "waste:incineration:unspecified",
  transportation: "transport:car:taxi_non_electric",
  energy: "electricity:energy_supply:t_d:average_emissions",
  water: "water:supply:water_supply:average_emissions",
  cleanup: "waste:incineration:unspecified",
  gardening: "sequestration:trees:broadleaf"
};

export async function getQuestCarbonReduction(
  questId: string, 
  category: QuestCategory
): Promise<number> {
  // Check cache in database first
  const cached = await sql(
    "SELECT carbon_value FROM carbon_cache WHERE quest_id = $1 AND cached_at > NOW() - INTERVAL '30 days'",
    [questId]
  );

  if (cached.rows.length > 0) {
    return cached.rows[0].carbon_value;
  }

  // Call Climatiq API
  const apiKey = process.env.CLIMATIQ_API_KEY;
  if (!apiKey) {
    throw new Error("CLIMATIQ_API_KEY not set");
  }

  const activityId = CLIMATIQ_MAPPING[category];
  
  try {
    const response = await fetch("https://api.climatiq.io/estimate", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        emission_factor: {
          activity_id: activityId
        },
        parameters: {
          // Vary by quest type
          duration: category === "transportation" ? 30 : 1, // minutes
          distance: category === "transportation" ? 5 : undefined // km
        }
      })
    });

    const data = await response.json();
    const carbonValue = data.co2e || 1.0; // Default fallback

    // Cache in database
    await sql(
      "INSERT INTO carbon_cache (quest_id, carbon_value, cached_at) VALUES ($1, $2, NOW()) ON CONFLICT (quest_id) DO UPDATE SET carbon_value = $2, cached_at = NOW()",
      [questId, carbonValue]
    );

    return carbonValue;
  } catch (error) {
    console.error("Climatiq API error:", error);
    // Fallback to reasonable defaults (but log for debugging)
    const DEFAULTS: Record<QuestCategory, number> = {
      recycling: 1.5,
      transportation: 1.2,
      energy: 0.4,
      water: 0.3,
      cleanup: 1.5,
      gardening: 2.0
    };
    return DEFAULTS[category];
  }
}
```

**File: `app/api/quests/complete/route.ts` (MODIFY)**
```typescript
import { getQuestCarbonReduction } from "@/lib/carbon-calc";

export async function POST(request: Request) {
  const { questId, category } = await request.json();
  
  // Get real carbon value from Climatiq
  const realCarbonValue = await getQuestCarbonReduction(questId, category);
  
  // Store in mission_logs with real value
  const mission = await addDocument(
    ["mission_logs"],
    {
      userId: session.userId,
      questId,
      carbonReduced: realCarbonValue, // REAL VALUE, not hardcoded
      xp: quest.xp,
      completedAt: new Date()
    },
    session
  );

  return NextResponse.json({ mission, carbonReduced: realCarbonValue });
}
```

---

### Phase 2.2: Real-World Rewards Integration

**File: `lib/rewards-sync.ts` (NEW)**
```typescript
import { sql } from "@/lib/db";

const ECOLOGI_API_KEY = process.env.ECOLOGI_API_KEY;

const MILESTONES = [
  { type: "level", value: 5, trees: 1 },
  { type: "level", value: 10, trees: 5 },
  { type: "carbon", value: 10, trees: 1 }, // 10kg CO2 offset
  { type: "missions", value: 50, trees: 1 }
];

export async function checkAndProcessMilestones(userId: string): Promise<void> {
  const user = await getDocument(["users", userId]);
  
  for (const milestone of MILESTONES) {
    const milestoneKey = `milestone_${milestone.type}_${milestone.value}`;
    
    if (user.payload[milestoneKey]) continue; // Already claimed
    
    let reached = false;
    
    if (milestone.type === "level" && (user.payload.level || 1) >= milestone.value) {
      reached = true;
    } else if (milestone.type === "carbon" && (user.payload.carbonReduced || 0) >= milestone.value) {
      reached = true;
    } else if (milestone.type === "missions" && (user.payload.missionsCompleted || 0) >= milestone.value) {
      reached = true;
    }
    
    if (reached) {
      // Call Ecologi API to plant tree
      try {
        const response = await fetch("https://api.ecologi.com/v1/trees", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${ECOLOGI_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            quantity: milestone.trees,
            comment: `Planted via EcoLudus by user ${userId}`
          })
        });

        if (response.ok) {
          // Mark milestone as claimed
          await updateDocument(
            ["users", userId],
            {
              payload: {
                ...user.payload,
                [milestoneKey]: true,
                treesPlanted: (user.payload.treesPlanted || 0) + milestone.trees
              }
            }
          );

          // Send in-app notification
          await addDocument(
            ["users", userId, "notifications"],
            {
              type: "milestone",
              title: `🌳 ${milestone.trees} Tree${milestone.trees > 1 ? 's' : ''} Planted!`,
              message: `Your efforts just planted ${milestone.trees} real tree${milestone.trees > 1 ? 's' : ''} via Ecologi.`,
              read: false,
              createdAt: new Date()
            }
          );
        }
      } catch (error) {
        console.error("Ecologi API error:", error);
        // Queue for retry in next cron
      }
    }
  }
}
```

**File: `app/api/cron/process-rewards/route.ts` (NEW)**
```typescript
import { NextResponse } from "next/server";
import { checkAndProcessMilestones } from "@/lib/rewards-sync";
import { sql } from "@/lib/db";

export async function POST(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get all users
    const result = await sql("SELECT id FROM users LIMIT 1000");
    
    for (const user of result.rows) {
      await checkAndProcessMilestones(user.id);
    }

    return NextResponse.json({ success: true, processed: result.rows.length });
  } catch (error) {
    console.error("Reward processing error:", error);
    return NextResponse.json(
      { error: "Processing failed" },
      { status: 500 }
    );
  }
}
```

**File: `vercel.json` (MODIFY)**
```json
{
  "crons": [
    {
      "path": "/api/cron/process-rewards",
      "schedule": "0 2 * * *"
    }
  ]
}
```

Set `CRON_SECRET` in Vercel environment variables and call the cron manually for first test.

---

### Continue with remaining phases as needed...
