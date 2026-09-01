import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { Pool, type QueryResultRow } from "pg";
import { logger, logError } from "@/lib/logger";
import { SHOP_SEED_ROWS, TEAM_MISSION_TEMPLATES } from "@/lib/catalog";

type QueryResult<T extends QueryResultRow = QueryResultRow> = {
  command: string;
  rowCount: number;
  rows: T[];
};

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  email_verified: boolean;
  token_version: number;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type TeamRow = {
  id: string;
  join_code: string;
  created_by: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type TeamSubdocRow = {
  id: string;
  team_id: string;
  mission_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
};

type MissionLogRow = {
  id: string;
  user_id: string;
  payload: Record<string, unknown>;
  created_at: string;
};

type VerificationTokenRow = {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
};

type PasswordResetTokenRow = {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
};

type CarbonCacheRow = {
  quest_id: string;
  carbon_value: number;
  source: string;
  source_payload: Record<string, unknown>;
  cached_at: string;
};

type MissionRow = {
  id: string;
  title: string;
  category: string;
  mission_type: string;
  visibility: string;
  base_xp: number;
  repeat_window_seconds: number;
  active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type CatalogItemRow = {
  mode: string;
  item_id: number;
  name: string;
  rarity: string;
  price: number;
  image: string;
  hatch_time: string | null;
  description: string | null;
  sort_order: number;
};

type TeamTemplateRow = {
  id: string;
  title: string;
  description: string;
  icon: string;
  difficulty: string;
  xp: number;
  eco: number;
  needed: number;
  sort_order: number;
};

type MissionSubmissionRow = {
  id: string;
  mission_id: string;
  user_id: string;
  before_value: string | null;
  after_value: string | null;
  description: string;
  confidence: number;
  submitted_at: string;
  submission_hash: string;
  time_window_key: string;
  status: string;
  final_xp: number;
  trust_before: number;
  trust_after: number;
  ip_hash: string | null;
  user_agent_hash: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

type FileStore = {
  users: UserRow[];
  teams: TeamRow[];
  team_active_missions: TeamSubdocRow[];
  team_mission_logs: TeamSubdocRow[];
  mission_logs: MissionLogRow[];
  carbon_cache: CarbonCacheRow[];
  photo_hashes: Array<Record<string, unknown>>;
  missions: MissionRow[];
  mission_submissions: MissionSubmissionRow[];
  private_mission_logs: Array<Record<string, unknown>>;
  ai_verification_results: Array<Record<string, unknown>>;
  team_progress: Array<Record<string, unknown>>;
  xp_transactions: Array<Record<string, unknown>>;
  trust_history: Array<Record<string, unknown>>;
  impact_events: Array<Record<string, unknown>>;
  catalog_items: CatalogItemRow[];
  team_mission_templates: TeamTemplateRow[];
  verification_tokens: VerificationTokenRow[];
  password_reset_tokens: PasswordResetTokenRow[];
};

declare global {
  var __ecoquestPool: Pool | undefined;
  var __ecoquestDbMode: "postgres" | "file" | undefined;
  var __ecoquestStore: FileStore | undefined;
  var __ecoquestStoreWrite: Promise<void> | undefined;
  var __ecoquestDetectModePromise: Promise<"postgres" | "file"> | undefined;
}

const STORE_PATH = process.env.VERCEL
  ? path.join("/tmp", "local-db.json")
  : path.join(process.cwd(), "data", "local-db.json");
const EMPTY_STORE: FileStore = {
  users: [],
  teams: [],
  team_active_missions: [],
  team_mission_logs: [],
  mission_logs: [],
  carbon_cache: [],
  photo_hashes: [],
  missions: [
    {
      id: "shower_reduce_5min",
      title: "Reduce shower time",
      category: "water",
      mission_type: "private",
      visibility: "private",
      base_xp: 40,
      repeat_window_seconds: 86400,
      active: true,
      metadata: { preferredBeforeAfter: true, unitHint: "minutes" },
      created_at: nowIso(),
      updated_at: nowIso()
    },
    {
      id: "drink_more_water",
      title: "Drink more water",
      category: "health",
      mission_type: "private",
      visibility: "private",
      base_xp: 25,
      repeat_window_seconds: 86400,
      active: true,
      metadata: { preferredBeforeAfter: true, unitHint: "cups or liters" },
      created_at: nowIso(),
      updated_at: nowIso()
    },
    {
      id: "limit_screen_time",
      title: "Limit screen time",
      category: "wellbeing",
      mission_type: "private",
      visibility: "private",
      base_xp: 35,
      repeat_window_seconds: 86400,
      active: true,
      metadata: { preferredBeforeAfter: true, unitHint: "minutes or hours" },
      created_at: nowIso(),
      updated_at: nowIso()
    }
  ],
  mission_submissions: [],
  private_mission_logs: [],
  ai_verification_results: [],
  team_progress: [],
  xp_transactions: [],
  trust_history: [],
  impact_events: [],
  catalog_items: SHOP_SEED_ROWS.map((row) => ({ ...row })),
  team_mission_templates: TEAM_MISSION_TEMPLATES.map((row, index) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    icon: row.icon,
    difficulty: row.difficulty,
    xp: row.xp,
    eco: row.eco,
    needed: row.needed,
    sort_order: index
  })),
  verification_tokens: [],
  password_reset_tokens: []
};

function nowIso() {
  return new Date().toISOString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function normalizeSql(text: string) {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function parseJsonObject(value: unknown) {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  return value;
}

function getConnectionString() {
  const candidates = [
    process.env.DATABASE_URL,
    process.env.POSTGRES_URL_NON_POOLING,
    process.env.POSTGRES_URL,
    process.env.POSTGRES_PRISMA_URL
  ];

  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value) {
      return value;
    }
  }

  return null;
}

function shouldUseSsl(connectionString: string) {
  if (process.env.POSTGRES_SSL === "true") {
    return true;
  }

  if (process.env.POSTGRES_SSL === "false") {
    return false;
  }

  return /supabase\.(co|com)|neon\.tech|render\.com|amazonaws\.com|rds\.amazonaws\.com/i.test(
    connectionString
  );
}

function isHostedRuntime() {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL === "1" ||
    process.env.NETLIFY === "true"
  );
}

function canUseLocalFileStore() {
  return !isHostedRuntime() && process.env.LOCAL_DB_MODE !== "postgres";
}

function missingProductionDatabaseError() {
  const error = new Error(
    "DATABASE_URL (or POSTGRES_URL from the Supabase/Vercel integration) is required in production. Refusing to use the local file database because it is reset on deploys and would lose user accounts."
  );
  error.name = "DatabaseSetupError";
  return error;
}

export function isDatabaseSetupError(error: unknown) {
  return error instanceof Error && error.name === "DatabaseSetupError";
}

function normalizeConnectionString(connectionString: string) {
  try {
    const url = new URL(connectionString);
    url.searchParams.delete("sslmode");
    url.searchParams.delete("ssl");
    return url.toString();
  } catch {
    return connectionString
      .replace(/([?&])sslmode=[^&]*/g, "$1")
      .replace(/([?&])ssl=[^&]*/g, "$1")
      .replace(/[?&]$/, "");
  }
}

function createPool() {
  const connectionString = getConnectionString();

  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured");
  }

  const useSsl = shouldUseSsl(connectionString);

  return new Pool({
    connectionString: normalizeConnectionString(connectionString),
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    max: isHostedRuntime() ? 1 : 10
  });
}

async function ensureStoreDir() {
  await mkdir(path.dirname(STORE_PATH), { recursive: true });
}

async function loadStore(): Promise<FileStore> {
  if (global.__ecoquestStore) {
    return global.__ecoquestStore;
  }

  await ensureStoreDir();

  try {
    const raw = await readFile(STORE_PATH, "utf8");
    global.__ecoquestStore = {
      ...clone(EMPTY_STORE),
      ...(JSON.parse(raw) as Partial<FileStore>)
    };
  } catch {
    global.__ecoquestStore = clone(EMPTY_STORE);
    await writeFile(STORE_PATH, JSON.stringify(global.__ecoquestStore, null, 2), "utf8");
  }

  // Both branches above assign global.__ecoquestStore, so this is defined.
  return global.__ecoquestStore!;
}

async function persistStore() {
  const store = await loadStore();
  await ensureStoreDir();

  const write = async () => {
    await writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
  };

  global.__ecoquestStoreWrite = (global.__ecoquestStoreWrite ?? Promise.resolve()).then(write, write);
  await global.__ecoquestStoreWrite;
}

function result<T extends QueryResultRow>(rows: T[], command = "SELECT"): QueryResult<T> {
  return {
    command,
    rowCount: rows.length,
    rows
  };
}

async function fileSql<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  const store = await loadStore();
  const normalized = normalizeSql(text);

  if (normalized === "select 1 as ok") {
    return result([{ ok: 1 } as unknown as T]);
  }

  if (normalized === "select id from users where email = $1 limit 1") {
    const email = String(params[0] ?? "");
    const row = store.users.find((user) => user.email === email);
    return result(row ? ([{ id: row.id }] as unknown as T[]) : []);
  }

  if (normalized === "select id, email, password_hash, email_verified, token_version, payload from users where email = $1 limit 1") {
    const email = String(params[0] ?? "");
    const row = store.users.find((user) => user.email === email);
    return result(
      row
        ? ([{ id: row.id, email: row.email, password_hash: row.password_hash, email_verified: row.email_verified, token_version: row.token_version, payload: clone(row.payload) }] as unknown as T[])
        : []
    );
  }

  if (normalized === "select id, email, payload from users where id = $1 limit 1") {
    const id = String(params[0] ?? "");
    const row = store.users.find((user) => user.id === id);
    return result(row ? ([{ id: row.id, email: row.email, payload: clone(row.payload) }] as unknown as T[]) : []);
  }

  if (normalized === "select id, email, xp, level, trust_score, payload from users where id = $1 limit 1") {
    const id = String(params[0] ?? "");
    const row = store.users.find((user) => user.id === id);
    if (!row) return result([] as unknown as T[]);
    return result(
      [
        {
          id: row.id,
          email: row.email,
          xp: Number((row.payload as any)?.xp ?? 0),
          level: Number((row.payload as any)?.level ?? 1),
          trust_score: Number((row.payload as any)?.trustScore ?? 50),
          payload: clone(row.payload)
        }
      ] as unknown as T[]
    );
  }

  if (normalized === "select id, email, payload from users order by created_at asc limit 100") {
    const rows = store.users
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .slice(0, 100)
      .map((row) => ({
        id: row.id,
        email: row.email,
        payload: clone(row.payload)
      }));
    return result(rows as unknown as T[]);
  }

  if (normalized === "select id, join_code, payload from teams where id = $1 limit 1") {
    const id = String(params[0] ?? "");
    const row = store.teams.find((team) => team.id === id);
    return result(
      row ? ([{ id: row.id, join_code: row.join_code, payload: clone(row.payload) }] as unknown as T[]) : []
    );
  }

  if (normalized === "select id, join_code, created_by, payload from teams where id = (select team_id from team_active_missions where payload->>'user_id' = $1 limit 1)") {
    const userId = String(params[0] ?? "");
    const teamActiveMission = store.team_active_missions.find((tam) => (tam.payload as any)?.user_id === userId);
    if (!teamActiveMission) {
      return result([] as unknown as T[]);
    }
    const row = store.teams.find((team) => team.id === teamActiveMission.team_id);
    return result(
      row ? ([{ id: row.id, join_code: row.join_code, created_by: row.created_by, payload: clone(row.payload) }] as unknown as T[]) : []
    );
  }

  if (normalized === "select id, payload from teams where join_code = $1 limit 1") {
    const joinCode = String(params[0] ?? "");
    const row = store.teams.find((team) => team.join_code === joinCode);
    return result(
      row ? ([{ id: row.id, payload: clone(row.payload) }] as unknown as T[]) : []
    );
  }

  if (normalized === "select payload from team_active_missions where team_id = $1 and id = $2 limit 1") {
    const [teamId, id] = [String(params[0] ?? ""), String(params[1] ?? "")];
    const row = store.team_active_missions.find((entry) => entry.team_id === teamId && entry.id === id);
    return result(row ? ([{ payload: clone(row.payload) }] as unknown as T[]) : []);
  }

  if (normalized === "select payload, mission_id from team_active_missions where team_id = $1 and id = $2 limit 1") {
    const [teamId, id] = [String(params[0] ?? ""), String(params[1] ?? "")];
    const row = store.team_active_missions.find((entry) => entry.team_id === teamId && entry.id === id);
    return result(row ? ([{ payload: clone(row.payload), mission_id: row.mission_id }] as unknown as T[]) : []);
  }

  if (normalized === "select count(*) as count from team_active_missions where team_id = $1 and mission_id is not null") {
    const teamId = String(params[0] ?? "");
    const count = store.team_active_missions.filter(
      (entry) => entry.team_id === teamId && entry.mission_id !== null
    ).length;
    return result([{ count }] as unknown as T[]);
  }

  if (normalized === "select id from team_active_missions where team_id = $1 and mission_id = $2 limit 1") {
    const [teamId, missionId] = [String(params[0] ?? ""), String(params[1] ?? "")];
    const row = store.team_active_missions.find(
      (entry) => entry.team_id === teamId && entry.mission_id === missionId
    );
    return result(row ? ([{ id: row.id }] as unknown as T[]) : []);
  }

  if (normalized === "select payload from team_mission_logs where team_id = $1 and id = $2 limit 1") {
    const [teamId, id] = [String(params[0] ?? ""), String(params[1] ?? "")];
    const row = store.team_mission_logs.find((entry) => entry.team_id === teamId && entry.id === id);
    return result(row ? ([{ payload: clone(row.payload) }] as unknown as T[]) : []);
  }

  if (normalized === "select payload from mission_logs where id = $1 limit 1") {
    const id = String(params[0] ?? "");
    const row = store.mission_logs.find((entry) => entry.id === id);
    return result(row ? ([{ payload: clone(row.payload) }] as unknown as T[]) : []);
  }

  if (
    normalized ===
    "select count(distinct user_id) as active_users, count(*) as total_missions, coalesce(sum((payload->>'xp')::numeric), 0) as total_xp, coalesce(sum((payload->>'carbonreduced')::numeric), 0) as total_co2_reduced from mission_logs"
  ) {
    // File-store mirror of the live-stats aggregate. Computes the same single
    // row in JS instead of loading every row into the caller.
    const logs = store.mission_logs;
    const activeUsers = new Set(logs.map((row) => row.user_id)).size;
    const totalMissions = logs.length;
    const totalXp = logs.reduce(
      (sum, row) => sum + (Number((row.payload as Record<string, unknown>)?.xp) || 0),
      0
    );
    const totalCo2 = logs.reduce(
      (sum, row) => sum + (Number((row.payload as Record<string, unknown>)?.carbonReduced) || 0),
      0
    );
    return result([
      { active_users: activeUsers, total_missions: totalMissions, total_xp: totalXp, total_co2_reduced: totalCo2 }
    ] as unknown as T[]);
  }

  if (
    normalized ===
    "select quest_id, carbon_value, source, source_payload, cached_at from carbon_cache where quest_id = $1 and cached_at > now() - interval '30 days' limit 1"
  ) {
    const questId = String(params[0] ?? "");
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const row = store.carbon_cache.find(
      (entry) => entry.quest_id === questId && new Date(entry.cached_at).getTime() > cutoff
    );
    return result(row ? ([clone(row)] as unknown as T[]) : []);
  }

  if (normalized === "select id, image_hash, user_id, quest_id, created_at from photo_hashes where image_hash = $1 limit 1") {
    const hash = String(params[0] ?? "");
    const row = store.photo_hashes.find((entry) => entry.image_hash === hash);
    return result(row ? ([clone(row)] as unknown as T[]) : []);
  }

  if (
    normalized ===
    "insert into photo_hashes (image_hash, user_id, quest_id) values ($1, $2, $3) on conflict (image_hash) do update set user_id = excluded.user_id, quest_id = excluded.quest_id, created_at = now()"
  ) {
    const [imageHash, userId, questId] = params;
    const hash = String(imageHash);
    const existing = store.photo_hashes.find((entry) => entry.image_hash === hash);

    if (existing) {
      existing.user_id = String(userId);
      existing.quest_id = questId === null ? null : String(questId);
      existing.created_at = nowIso();
    } else {
      store.photo_hashes.push({
        id: randomUUID(),
        image_hash: hash,
        user_id: String(userId),
        quest_id: questId === null ? null : String(questId),
        created_at: nowIso()
      });
    }

    await persistStore();
    return result([], "INSERT");
  }

  if (
    normalized ===
    "select id, title, category, base_xp, repeat_window_seconds, metadata from missions where active = true and mission_type = 'private' order by title asc"
  ) {
    const rows = store.missions
      .filter((mission) => mission.active && mission.mission_type === "private")
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((mission) => ({
        id: mission.id,
        title: mission.title,
        category: mission.category,
        base_xp: mission.base_xp,
        repeat_window_seconds: mission.repeat_window_seconds,
        metadata: clone(mission.metadata)
      }));
    return result(rows as unknown as T[]);
  }

  if (
    normalized ===
    "select id, title, base_xp, repeat_window_seconds from missions where id = $1 and active = true and mission_type = 'private' limit 1"
  ) {
    const id = String(params[0] ?? "");
    const row = store.missions.find((mission) => mission.id === id && mission.active && mission.mission_type === "private");
    return result(
      row
        ? ([
            {
              id: row.id,
              title: row.title,
              base_xp: row.base_xp,
              repeat_window_seconds: row.repeat_window_seconds
            }
          ] as unknown as T[])
        : []
    );
  }

  if (
    normalized ===
    "select count(*) as count from mission_submissions where user_id = $1 and submitted_at > now() - interval '1 hour'"
  ) {
    const userId = String(params[0] ?? "");
    const cutoff = Date.now() - 60 * 60 * 1000;
    const count = store.mission_submissions.filter(
      (entry) => entry.user_id === userId && new Date(entry.submitted_at).getTime() > cutoff
    ).length;
    return result([{ count }] as unknown as T[]);
  }

  if (
    normalized ===
    "select count(distinct mission_id) as count from mission_submissions where user_id = $1 and submitted_at > now() - interval '14 days'"
  ) {
    const userId = String(params[0] ?? "");
    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const missionIds = new Set(
      store.mission_submissions
        .filter((entry) => entry.user_id === userId && new Date(entry.submitted_at).getTime() > cutoff)
        .map((entry) => entry.mission_id)
    );
    return result([{ count: missionIds.size }] as unknown as T[]);
  }

  if (
    normalized ===
    "select mission_id, status, submitted_at, before_value, after_value, description from mission_submissions where user_id = $1 order by submitted_at desc limit 20"
  ) {
    const userId = String(params[0] ?? "");
    const rows = store.mission_submissions
      .filter((entry) => entry.user_id === userId)
      .sort((a, b) => b.submitted_at.localeCompare(a.submitted_at))
      .slice(0, 20)
      .map((entry) => ({
        mission_id: entry.mission_id,
        status: entry.status,
        submitted_at: entry.submitted_at,
        before_value: entry.before_value,
        after_value: entry.after_value,
        description: entry.description
      }));
    return result(rows as unknown as T[]);
  }

  if (
    normalized ===
    "insert into mission_submissions ( id, mission_id, user_id, before_value, after_value, description, confidence, submitted_at, submission_hash, time_window_key, status, final_xp, trust_before, trust_after, ip_hash, user_agent_hash, metadata ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb)"
  ) {
    const [
      id,
      missionId,
      userId,
      beforeValue,
      afterValue,
      description,
      confidence,
      submittedAt,
      submissionHash,
      timeWindowKey,
      status,
      finalXp,
      trustBefore,
      trustAfter,
      ipHash,
      userAgentHash,
      metadataRaw
    ] = params;

    const duplicate = store.mission_submissions.some(
      (entry) =>
        entry.submission_hash === submissionHash ||
        (entry.user_id === userId && entry.mission_id === missionId && entry.time_window_key === timeWindowKey)
    );
    if (duplicate) {
      const error = new Error("duplicate mission submission") as Error & { code?: string };
      error.code = "23505";
      throw error;
    }

    store.mission_submissions.push({
      id: String(id),
      mission_id: String(missionId),
      user_id: String(userId),
      before_value: beforeValue === null ? null : String(beforeValue),
      after_value: afterValue === null ? null : String(afterValue),
      description: String(description),
      confidence: Number(confidence),
      submitted_at: String(submittedAt),
      submission_hash: String(submissionHash),
      time_window_key: String(timeWindowKey),
      status: String(status),
      final_xp: Number(finalXp),
      trust_before: Number(trustBefore),
      trust_after: Number(trustAfter),
      ip_hash: ipHash === null ? null : String(ipHash),
      user_agent_hash: userAgentHash === null ? null : String(userAgentHash),
      metadata: parseJsonObject(metadataRaw) as Record<string, unknown>,
      created_at: nowIso()
    });
    await persistStore();
    return result([], "INSERT");
  }

  if (
    normalized ===
    "insert into private_mission_logs ( id, submission_id, mission_id, user_id, before_value, after_value, description, self_confidence, logged_at ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)"
  ) {
    const [id, submissionId, missionId, userId, beforeValue, afterValue, description, confidence, loggedAt] = params;
    store.private_mission_logs.push({
      id: String(id),
      submission_id: String(submissionId),
      mission_id: String(missionId),
      user_id: String(userId),
      before_value: beforeValue === null ? null : String(beforeValue),
      after_value: afterValue === null ? null : String(afterValue),
      description: String(description),
      self_confidence: Number(confidence),
      logged_at: String(loggedAt)
    });
    await persistStore();
    return result([], "INSERT");
  }

  if (
    normalized ===
    "insert into ai_verification_results ( id, submission_id, status, confidence, realism_score, reasoning, risk_flags, provider, verified_at ) values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, now())"
  ) {
    const [id, submissionId, status, confidence, realismScore, reasoning, riskFlagsRaw, provider] = params;
    store.ai_verification_results.push({
      id: String(id),
      submission_id: String(submissionId),
      status: String(status),
      confidence: Number(confidence),
      realism_score: Number(realismScore),
      reasoning: String(reasoning),
      risk_flags: parseJsonObject(riskFlagsRaw),
      provider: provider === null ? null : String(provider),
      verified_at: nowIso()
    });
    await persistStore();
    return result([], "INSERT");
  }

  if (
    normalized ===
    "insert into trust_history ( id, user_id, submission_id, previous_score, next_score, delta, reason, risk_flags ) values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)"
  ) {
    const [id, userId, submissionId, previousScore, nextScore, delta, reasonText, riskFlagsRaw] = params;
    store.trust_history.push({
      id: String(id),
      user_id: String(userId),
      submission_id: String(submissionId),
      previous_score: Number(previousScore),
      next_score: Number(nextScore),
      delta: Number(delta),
      reason: String(reasonText),
      risk_flags: parseJsonObject(riskFlagsRaw),
      created_at: nowIso()
    });
    await persistStore();
    return result([], "INSERT");
  }

  if (
    normalized ===
    "insert into xp_transactions ( id, user_id, submission_id, amount, reason, trust_multiplier, verification_status, metadata ) values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)"
  ) {
    const [id, userId, submissionId, amount, reasonText, trustMultiplier, verificationStatus, metadataRaw] = params;
    store.xp_transactions.push({
      id: String(id),
      user_id: String(userId),
      submission_id: String(submissionId),
      amount: Number(amount),
      reason: String(reasonText),
      trust_multiplier: Number(trustMultiplier),
      verification_status: String(verificationStatus),
      metadata: parseJsonObject(metadataRaw),
      created_at: nowIso()
    });
    await persistStore();
    return result([], "INSERT");
  }

  if (
    normalized ===
    "insert into team_progress ( id, team_id, user_id, submission_id, points, source, created_at ) values ($1, $2, $3, $4, $5, $6, now())"
  ) {
    const [id, teamId, userId, submissionId, points, source] = params;
    store.team_progress.push({
      id: String(id),
      team_id: String(teamId),
      user_id: String(userId),
      submission_id: String(submissionId),
      points: Number(points),
      source: String(source),
      created_at: nowIso()
    });
    await persistStore();
    return result([], "INSERT");
  }

  if (
    normalized ===
    "update users set xp = $1, level = $2, trust_score = $3, payload = $4::jsonb, updated_at = now() where id = $5"
  ) {
    const [xp, level, trustScore, payloadRaw, id] = params;
    const row = store.users.find((user) => user.id === id);
    if (row) {
      row.payload = {
        ...(parseJsonObject(payloadRaw) as Record<string, unknown>),
        xp: Number(xp),
        level: Number(level),
        trustScore: Number(trustScore)
      };
      row.updated_at = nowIso();
    }
    await persistStore();
    return result([], "UPDATE");
  }

  if (
    normalized ===
    "insert into carbon_cache (quest_id, carbon_value, source, source_payload, cached_at) values ($1, $2, $3, $4::jsonb, now()) on conflict (quest_id) do update set carbon_value = excluded.carbon_value, source = excluded.source, source_payload = excluded.source_payload, cached_at = now()"
  ) {
    const [questId, carbonValue, source, sourcePayloadRaw] = params;
    const id = String(questId);
    const existing = store.carbon_cache.find((entry) => entry.quest_id === id);
    const nextRow = {
      quest_id: id,
      carbon_value: Number(carbonValue ?? 0),
      source: String(source ?? "unknown"),
      source_payload: parseJsonObject(sourcePayloadRaw) as Record<string, unknown>,
      cached_at: nowIso()
    };

    if (existing) {
      Object.assign(existing, nextRow);
    } else {
      store.carbon_cache.push(nextRow);
    }

    await persistStore();
    return result([], "INSERT");
  }

  if (
    normalized ===
    "insert into users (id, email, password_hash, payload) values ($1, $2, $3, $4::jsonb)"
  ) {
    const [id, email, passwordHash, payloadRaw] = params;
    const existing = store.users.find((user) => user.id === id);
    if (existing) {
      existing.email = String(email);
      existing.password_hash = String(passwordHash);
      existing.payload = parseJsonObject(payloadRaw) as Record<string, unknown>;
      existing.updated_at = nowIso();
    } else {
      store.users.push({
        id: String(id),
        email: String(email),
        password_hash: String(passwordHash),
        email_verified: false,
        token_version: 0,
        payload: parseJsonObject(payloadRaw) as Record<string, unknown>,
        created_at: nowIso(),
        updated_at: nowIso()
      });
    }
    await persistStore();
    return result([], "INSERT");
  }

  if (
    normalized ===
    "insert into users (id, email, password_hash, payload) values ($1, $2, coalesce((select password_hash from users where id = $1), ''), $3::jsonb) on conflict (id) do update set email = excluded.email, payload = excluded.payload, updated_at = now()"
  ) {
    const [id, email, payloadRaw] = params;
    const existing = store.users.find((user) => user.id === id);
    if (existing) {
      existing.email = String(email);
      existing.payload = parseJsonObject(payloadRaw) as Record<string, unknown>;
      existing.updated_at = nowIso();
    } else {
      store.users.push({
        id: String(id),
        email: String(email),
        password_hash: "",
        email_verified: false,
        token_version: 0,
        payload: parseJsonObject(payloadRaw) as Record<string, unknown>,
        created_at: nowIso(),
        updated_at: nowIso()
      });
    }
    await persistStore();
    return result([], "INSERT");
  }

  if (
    normalized ===
    "insert into users (id, email, password_hash, xp, level, payload) values ($1, $2, coalesce((select password_hash from users where id = $1), ''), $4, $5, $3::jsonb) on conflict (id) do update set email = excluded.email, xp = excluded.xp, level = excluded.level, payload = excluded.payload, updated_at = now()"
  ) {
    const [id, email, payloadRaw, xp, level] = params;
    const nextPayload = {
      ...(parseJsonObject(payloadRaw) as Record<string, unknown>),
      xp: Number(xp),
      level: Number(level)
    };
    const existing = store.users.find((user) => user.id === id);

    if (existing) {
      existing.email = String(email);
      existing.payload = nextPayload;
      existing.updated_at = nowIso();
    } else {
      store.users.push({
        id: String(id),
        email: String(email),
        password_hash: "",
        email_verified: false,
        token_version: 0,
        payload: nextPayload,
        created_at: nowIso(),
        updated_at: nowIso()
      });
    }

    await persistStore();
    return result([], "INSERT");
  }

  if (
    normalized ===
    "insert into teams (id, join_code, created_by, payload) values ($1, $2, $3, $4::jsonb) on conflict (id) do update set join_code = excluded.join_code, payload = excluded.payload, updated_at = now()"
  ) {
    const [id, joinCode, createdBy, payloadRaw] = params;
    const existing = store.teams.find((team) => team.id === id);
    if (existing) {
      existing.join_code = String(joinCode);
      existing.payload = parseJsonObject(payloadRaw) as Record<string, unknown>;
      existing.updated_at = nowIso();
    } else {
      store.teams.push({
        id: String(id),
        join_code: String(joinCode),
        created_by: createdBy ? String(createdBy) : null,
        payload: parseJsonObject(payloadRaw) as Record<string, unknown>,
        created_at: nowIso(),
        updated_at: nowIso()
      });
    }
    await persistStore();
    return result([], "INSERT");
  }

  if (
    normalized ===
    "insert into teams (join_code, created_by, payload) values ($1, $2, $3::jsonb) returning id"
  ) {
    const [joinCode, createdBy, payloadRaw] = params;
    const newId = randomUUID();
    store.teams.push({
      id: newId,
      join_code: String(joinCode),
      created_by: createdBy ? String(createdBy) : null,
      payload: parseJsonObject(payloadRaw) as Record<string, unknown>,
      created_at: nowIso(),
      updated_at: nowIso()
    });
    await persistStore();
    return result([{ id: newId }] as unknown as T[], "INSERT");
  }

  if (
    normalized ===
    "insert into team_active_missions (id, team_id, mission_id, payload) values ($1, $2, $3, $4::jsonb) on conflict (id) do update set mission_id = excluded.mission_id, payload = excluded.payload, updated_at = now()"
  ) {
    const [id, teamId, missionId, payloadRaw] = params;
    const existing = store.team_active_missions.find((entry) => entry.id === id);
    if (existing) {
      existing.team_id = String(teamId);
      existing.mission_id = missionId ? String(missionId) : null;
      existing.payload = parseJsonObject(payloadRaw) as Record<string, unknown>;
      existing.updated_at = nowIso();
    } else {
      store.team_active_missions.push({
        id: String(id),
        team_id: String(teamId),
        mission_id: missionId ? String(missionId) : null,
        payload: parseJsonObject(payloadRaw) as Record<string, unknown>,
        created_at: nowIso(),
        updated_at: nowIso()
      });
    }
    await persistStore();
    return result([], "INSERT");
  }

  if (
    normalized ===
    "insert into team_active_missions (id, team_id, payload) values ($1, $2, $3::jsonb)"
  ) {
    const [id, teamId, payloadRaw] = params;
    store.team_active_missions.push({
      id: String(id),
      team_id: String(teamId),
      mission_id: null,
      payload: parseJsonObject(payloadRaw) as Record<string, unknown>,
      created_at: nowIso(),
      updated_at: nowIso()
    });
    await persistStore();
    return result([], "INSERT");
  }

  if (
    normalized ===
    "insert into team_mission_logs (id, team_id, mission_id, payload) values ($1, $2, $3, $4::jsonb) on conflict (id) do update set mission_id = excluded.mission_id, payload = excluded.payload"
  ) {
    const [id, teamId, missionId, payloadRaw] = params;
    const existing = store.team_mission_logs.find((entry) => entry.id === id);
    if (existing) {
      existing.team_id = String(teamId);
      existing.mission_id = missionId ? String(missionId) : null;
      existing.payload = parseJsonObject(payloadRaw) as Record<string, unknown>;
    } else {
      store.team_mission_logs.push({
        id: String(id),
        team_id: String(teamId),
        mission_id: missionId ? String(missionId) : null,
        payload: parseJsonObject(payloadRaw) as Record<string, unknown>,
        created_at: nowIso()
      });
    }
    await persistStore();
    return result([], "INSERT");
  }

  if (
    normalized ===
    "insert into mission_logs (id, user_id, payload) values ($1, $2, $3::jsonb) on conflict (id) do update set user_id = excluded.user_id, payload = excluded.payload"
  ) {
    const [id, userId, payloadRaw] = params;
    const existing = store.mission_logs.find((entry) => entry.id === id);
    if (existing) {
      existing.user_id = String(userId);
      existing.payload = parseJsonObject(payloadRaw) as Record<string, unknown>;
    } else {
      store.mission_logs.push({
        id: String(id),
        user_id: String(userId),
        payload: parseJsonObject(payloadRaw) as Record<string, unknown>,
        created_at: nowIso()
      });
    }
    await persistStore();
    return result([], "INSERT");
  }

  if (normalized === "select password_hash from users where id = $1 limit 1") {
    const id = String(params[0] ?? "");
    const row = store.users.find((user) => user.id === id);
    return result(row ? ([{ password_hash: row.password_hash }] as unknown as T[]) : []);
  }

  if (normalized === "delete from users where id = $1") {
    const id = String(params[0] ?? "");
    store.users = store.users.filter((user) => user.id !== id);
    store.mission_logs = store.mission_logs.filter((entry) => entry.user_id !== id);
    store.mission_submissions = store.mission_submissions.filter((entry) => entry.user_id !== id);
    store.private_mission_logs = store.private_mission_logs.filter((entry) => entry.user_id !== id);
    store.xp_transactions = store.xp_transactions.filter((entry) => (entry as any).user_id !== id);
    store.trust_history = store.trust_history.filter((entry) => (entry as any).user_id !== id);
    store.impact_events = store.impact_events.filter((entry) => entry.user_id !== id);
    store.team_progress = store.team_progress.filter((entry) => (entry as any).user_id !== id);
    store.photo_hashes = store.photo_hashes.filter((entry) => entry.user_id !== id);
    store.team_active_missions = store.team_active_missions.filter((entry) => String((entry.payload as any)?.user_id ?? "") !== id);
    store.verification_tokens = store.verification_tokens.filter((entry) => entry.user_id !== id);
    store.password_reset_tokens = store.password_reset_tokens.filter((entry) => entry.user_id !== id);
    // teams.created_by → set null (mirrors on delete set null)
    store.teams = store.teams.map((team) => (team.created_by === id ? { ...team, created_by: null } : team));
    await persistStore();
    return result([], "DELETE");
  }

  // ── Community aggregate (used by /api/stats/community-aggregate) ─────────
  if (
    normalized ===
    "select count(*) as total_users, coalesce(sum((payload->>'xp')::numeric), 0) as total_xp, coalesce(sum((payload->>'carbonreduced')::numeric), 0) as total_co2, coalesce(sum((payload->>'missionscompleted')::numeric), 0) as total_missions, coalesce(sum((payload->>'treesplanted')::numeric), 0) as total_trees from users"
  ) {
    const totalUsers = store.users.length;
    const totalXp = store.users.reduce((s, u) => s + Number((u.payload as any)?.xp ?? 0), 0);
    const totalCo2 = store.users.reduce((s, u) => s + Number((u.payload as any)?.carbonReduced ?? 0), 0);
    const totalMissions = store.users.reduce((s, u) => s + Number((u.payload as any)?.missionsCompleted ?? 0), 0);
    const totalTrees = store.users.reduce((s, u) => s + Number((u.payload as any)?.treesPlanted ?? 0), 0);
    return result([{ total_users: totalUsers, total_xp: totalXp, total_co2: totalCo2, total_missions: totalMissions, total_trees: totalTrees }] as unknown as T[]);
  }

  // ── Cron: list all users for milestone processing ─────────────────────────
  if (normalized === "select id from users limit 1000") {
    const rows = store.users.slice(0, 1000).map((u) => ({ id: u.id }));
    return result(rows as unknown as T[]);
  }

  // ── rewards-sync: update payload only ─────────────────────────────────────
  if (
    normalized ===
    "update users set payload = $1::jsonb, updated_at = now() where id = $2"
  ) {
    const [payloadRaw, id] = params;
    const row = store.users.find((u) => u.id === id);
    if (row) {
      row.payload = parseJsonObject(payloadRaw) as Record<string, unknown>;
      row.updated_at = nowIso();
    }
    await persistStore();
    return result([], "UPDATE");
  }

  if (normalized === "delete from teams where id = $1") {
    const id = String(params[0] ?? "");
    store.teams = store.teams.filter((team) => team.id !== id);
    store.team_active_missions = store.team_active_missions.filter((entry) => entry.team_id !== id);
    store.team_mission_logs = store.team_mission_logs.filter((entry) => entry.team_id !== id);
    await persistStore();
    return result([], "DELETE");
  }

  if (normalized === "delete from team_active_missions where team_id = $1 and id = $2") {
    const [teamId, id] = [String(params[0] ?? ""), String(params[1] ?? "")];
    store.team_active_missions = store.team_active_missions.filter(
      (entry) => !(entry.team_id === teamId && entry.id === id)
    );
    await persistStore();
    return result([], "DELETE");
  }

  if (normalized === "delete from team_mission_logs where team_id = $1 and id = $2") {
    const [teamId, id] = [String(params[0] ?? ""), String(params[1] ?? "")];
    store.team_mission_logs = store.team_mission_logs.filter(
      (entry) => !(entry.team_id === teamId && entry.id === id)
    );
    await persistStore();
    return result([], "DELETE");
  }

  if (normalized === "delete from mission_logs where id = $1 and user_id = $2") {
    const [id, userId] = [String(params[0] ?? ""), String(params[1] ?? "")];
    store.mission_logs = store.mission_logs.filter(
      (entry) => !(entry.id === id && entry.user_id === userId)
    );
    await persistStore();
    return result([], "DELETE");
  }

  if (normalized === "select id, email, payload from users order by created_at asc limit $1") {
    const limitValue = Number(params[0] ?? 100);
    const rows = store.users
      .slice()
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .slice(0, limitValue)
      .map((row) => ({
        id: row.id,
        email: row.email,
        payload: clone(row.payload)
      }));

    return result(rows as unknown as T[]);
  }

  if (
    normalized ===
      "select distinct u.id, u.email, u.payload from team_active_missions tam join users u on (tam.payload->>'user_id')::text = u.id where tam.team_id = $1" ||
    normalized ===
      "select distinct u.id, u.email, u.payload from team_active_missions tam join users u on u.id::text = tam.payload->>'user_id' where tam.team_id = $1"
  ) {
    const teamId = String(params[0] ?? "");
    const teamActiveMissions = store.team_active_missions.filter((tam) => tam.team_id === teamId);
    const userIds = [...new Set(teamActiveMissions.map((tam) => (tam.payload as any)?.user_id).filter(Boolean))];
    const users = store.users.filter((u) => userIds.includes(u.id));
    const rows = users.map((u) => ({
      id: u.id,
      email: u.email,
      payload: clone(u.payload)
    }));
    return result(rows as unknown as T[]);
  }

  if (
    normalized ===
      "select coalesce(sum((payload->>'xp')::int), 0) as total_xp, coalesce(sum((payload->>'ecopoints')::int), 0) as total_eco, count(*) as member_count from users where id in (select distinct (payload->>'user_id')::text from team_active_missions where team_id = $1)" ||
    normalized ===
      "select coalesce(sum((payload->>'xp')::int), 0) as total_xp, coalesce(sum((payload->>'ecopoints')::int), 0) as total_eco, count(*) as member_count from users where id::text in (select distinct payload->>'user_id' from team_active_missions where team_id = $1)"
  ) {
    const teamId = String(params[0] ?? "");
    const teamActiveMissions = store.team_active_missions.filter((tam) => tam.team_id === teamId);
    const userIds = [...new Set(teamActiveMissions.map((tam) => (tam.payload as any)?.user_id).filter(Boolean))];
    const users = store.users.filter((u) => userIds.includes(u.id));
    const totalXp = users.reduce((sum, u) => sum + ((u.payload as any)?.xp || 0), 0);
    const totalEco = users.reduce((sum, u) => sum + ((u.payload as any)?.ecoPoints || 0), 0);
    return result([{ total_xp: totalXp, total_eco: totalEco, member_count: users.length }] as unknown as T[]);
  }

  if (normalized === "select count(*) as missions_completed from team_mission_logs where team_id = $1") {
    const teamId = String(params[0] ?? "");
    const count = store.team_mission_logs.filter((entry) => entry.team_id === teamId).length;
    return result([{ missions_completed: count }] as unknown as T[]);
  }

  if (
    normalized ===
    "select t.id, t.payload, coalesce(sum((u.payload->>'xp')::numeric), 0) as total_xp, coalesce(sum((u.payload->>'ecopoints')::numeric), 0) as total_eco, count(u.id) as member_count, (select count(*) from team_mission_logs tml where tml.team_id = t.id) as missions_completed from teams t left join team_active_missions tam on tam.team_id = t.id left join users u on u.id::text = tam.payload->>'user_id' group by t.id order by t.created_at desc limit $1"
  ) {
    // File-store mirror of the /api/stats/team-aggregate single-query form:
    // per-team sum of member XP/eco (over team_active_missions × users), the
    // count of joined rows that resolve to a user, and the team's mission-log
    // count. Teams are ordered by created_at desc and capped at the limit.
    // NOTE: join_code is deliberately NOT mirrored here — it is a private
    // secret and must not appear on the public team leaderboard.
    const limitValue = Math.max(0, Number(params[0] ?? 50) || 50);
    const rows = [...store.teams]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limitValue)
      .map((team) => {
        const teamActiveMissions = store.team_active_missions.filter(
          (tam) => tam.team_id === team.id
        );
        const memberUsers = teamActiveMissions
          .map((tam) => store.users.find((u) => u.id === String((tam.payload as Record<string, unknown>)?.user_id ?? "")))
          .filter((u): u is UserRow => Boolean(u));
        const totalXp = memberUsers.reduce(
          (sum, u) => sum + Number((u.payload as Record<string, unknown>)?.xp ?? 0),
          0
        );
        const totalEco = memberUsers.reduce(
          (sum, u) => sum + Number((u.payload as Record<string, unknown>)?.ecoPoints ?? 0),
          0
        );
        const missionsCompleted = store.team_mission_logs.filter(
          (entry) => entry.team_id === team.id
        ).length;
        return {
          id: team.id,
          payload: clone(team.payload),
          total_xp: totalXp,
          total_eco: totalEco,
          member_count: memberUsers.length,
          missions_completed: missionsCompleted
        };
      });
    return result(rows as unknown as T[]);
  }

  if (normalized === "select id, mission_id, payload from team_active_missions where team_id = $1 order by created_at desc") {
    const teamId = String(params[0] ?? "");
    const rows = store.team_active_missions
      .filter((tam) => tam.team_id === teamId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((row) => ({
        id: row.id,
        mission_id: row.mission_id,
        payload: clone(row.payload)
      }));
    return result(rows as unknown as T[]);
  }

  if (normalized === "select team_id from team_active_missions where payload->>'user_id' = $1 limit 1") {
    const userId = String(params[0] ?? "");
    const row = store.team_active_missions.find((tam) => (tam.payload as any)?.user_id === userId);
    return result(row ? ([{ team_id: row.team_id }] as unknown as T[]) : []);
  }

  if (normalized === "delete from team_active_missions where payload->>'user_id' = $1") {
    const userId = String(params[0] ?? "");
    store.team_active_missions = store.team_active_missions.filter((tam) => (tam.payload as any)?.user_id !== userId);
    await persistStore();
    return result([], "DELETE");
  }

  if (normalized === "select id, join_code, payload from teams order by created_at desc limit $1") {
    const limitValue = Number(params[0] ?? 100);
    const rows = store.teams
      .slice()
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limitValue)
      .map((row) => ({
        id: row.id,
        join_code: row.join_code,
        payload: clone(row.payload)
      }));

    return result(rows as unknown as T[]);
  }

  if (
    normalized ===
    "select id, join_code, payload from teams where join_code = $1 order by created_at desc limit $2"
  ) {
    const joinCode = String(params[0] ?? "");
    const limitValue = Number(params[1] ?? 100);
    const rows = store.teams
      .filter((row) => row.join_code === joinCode)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limitValue)
      .map((row) => ({
        id: row.id,
        join_code: row.join_code,
        payload: clone(row.payload)
      }));

    return result(rows as unknown as T[]);
  }

  if (
    normalized ===
    "select id, payload from team_active_missions where team_id = $1 order by created_at desc limit $2"
  ) {
    const [teamId, limitValue] = [String(params[0] ?? ""), Number(params[1] ?? 100)];
    const rows = store.team_active_missions
      .filter((entry) => entry.team_id === teamId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limitValue)
      .map((row) => ({
        id: row.id,
        payload: clone(row.payload)
      }));

    return result(rows as unknown as T[]);
  }

  if (
    normalized ===
    "select id, payload from team_mission_logs where team_id = $1 order by created_at desc limit $2"
  ) {
    const [teamId, limitValue] = [String(params[0] ?? ""), Number(params[1] ?? 100)];
    const rows = store.team_mission_logs
      .filter((entry) => entry.team_id === teamId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limitValue)
      .map((row) => ({
        id: row.id,
        payload: clone(row.payload)
      }));

    return result(rows as unknown as T[]);
  }

  if (
    normalized ===
    "select id, payload from team_mission_logs where team_id = $1 and mission_id = $2 order by created_at desc limit $3"
  ) {
    const [teamId, missionId, limitValue] = [
      String(params[0] ?? ""),
      String(params[1] ?? ""),
      Number(params[2] ?? 100)
    ];
    const rows = store.team_mission_logs
      .filter((entry) => entry.team_id === teamId && entry.mission_id === missionId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limitValue)
      .map((row) => ({
        id: row.id,
        payload: clone(row.payload)
      }));

    return result(rows as unknown as T[]);
  }

  if (
    normalized ===
    "select id, payload from mission_logs where user_id = $1 order by created_at desc limit $2"
  ) {
    const [userId, limitValue] = [String(params[0] ?? ""), Number(params[1] ?? 100)];
    const rows = store.mission_logs
      .filter((entry) => entry.user_id === userId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limitValue)
      .map((row) => ({
        id: row.id,
        payload: clone(row.payload)
      }));

    return result(rows as unknown as T[]);
  }

  // ── Impact spine: append-only ledger ───────────────────────────────────────
  if (
    normalized ===
    "insert into impact_events (id, user_id, source, amount, meta) values ($1, $2, $3, $4, $5::jsonb)"
  ) {
    const [id, userId, source, amount, metaRaw] = params;
    store.impact_events.push({
      id: String(id),
      user_id: String(userId),
      source: String(source),
      amount: Number(amount),
      meta: parseJsonObject(metaRaw) as Record<string, unknown>,
      created_at: nowIso()
    });
    await persistStore();
    return result([], "INSERT");
  }

  if (
    normalized ===
    "select coalesce(sum(amount), 0) as week_impact from impact_events where user_id = $1 and created_at >= $2"
  ) {
    const [userId, sinceRaw] = [String(params[0] ?? ""), params[1]];
    const since = typeof sinceRaw === "string" ? new Date(sinceRaw).getTime() : 0;
    const weekImpact = store.impact_events
      .filter(
        (entry) =>
          String(entry.user_id) === userId && new Date(String(entry.created_at)).getTime() >= since
      )
      .reduce((sum, entry) => sum + Number(entry.amount ?? 0), 0);
    return result([{ week_impact: weekImpact }] as unknown as T[]);
  }

  if (
    normalized ===
    "select id, source, amount, meta, created_at from impact_events where user_id = $1 and created_at >= $2 order by created_at desc limit $3"
  ) {
    const [userId, sinceRaw, limitValue] = [String(params[0] ?? ""), params[1], Number(params[2] ?? 100)];
    const since = typeof sinceRaw === "string" ? new Date(sinceRaw).getTime() : 0;
    const rows = store.impact_events
      .filter(
        (entry) =>
          String(entry.user_id) === userId && new Date(String(entry.created_at)).getTime() >= since
      )
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .slice(0, limitValue)
      .map((entry) => ({
        id: entry.id,
        source: entry.source,
        amount: Number(entry.amount),
        meta: clone(entry.meta),
        created_at: entry.created_at
      }));
    return result(rows as unknown as T[]);
  }

  if (
    normalized ===
    "select mode, item_id, name, rarity, price, image, hatch_time, description, sort_order from catalog_items order by mode, sort_order, item_id"
  ) {
    const rows = [...store.catalog_items]
      .sort((a, b) =>
        a.mode === b.mode
          ? a.sort_order - b.sort_order || a.item_id - b.item_id
          : a.mode.localeCompare(b.mode)
      )
      .map((row) => ({ ...row }));
    return result(rows as unknown as T[]);
  }

  if (
    normalized ===
    "select mode, item_id, name, rarity, price, image, hatch_time, description, sort_order from catalog_items where mode = $1 and item_id = $2 limit 1"
  ) {
    const mode = String(params[0] ?? "");
    const itemId = Number(params[1] ?? 0);
    const row = store.catalog_items.find(
      (entry) => entry.mode === mode && entry.item_id === itemId
    );
    return result(row ? ([{ ...row }] as unknown as T[]) : []);
  }

  if (
    normalized ===
    "select id, title, description, icon, difficulty, xp, eco, needed, sort_order from team_mission_templates order by sort_order"
  ) {
    const rows = [...store.team_mission_templates]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((row) => ({ ...row }));
    return result(rows as unknown as T[]);
  }

  if (
    normalized ===
    "select id, title, description, icon, difficulty, xp, eco, needed, sort_order from team_mission_templates where id = $1 limit 1"
  ) {
    const id = String(params[0] ?? "");
    const row = store.team_mission_templates.find((entry) => entry.id === id);
    return result(row ? ([{ ...row }] as unknown as T[]) : []);
  }

  if (normalized === "select email_verified, token_version from users where id = $1 limit 1") {
    const id = String(params[0] ?? "");
    const row = store.users.find((user) => user.id === id);
    return result(
      row
        ? ([{ email_verified: row.email_verified, token_version: row.token_version }] as unknown as T[])
        : []
    );
  }

  if (normalized === "insert into verification_tokens (id, user_id, token_hash, expires_at) values ($1, $2, $3, $4)") {
    const [id, userId, tokenHash, expiresAt] = params;
    // Replace any previous unused token for this user (one outstanding verify token).
    store.verification_tokens = store.verification_tokens.filter((entry) => entry.user_id !== String(userId));
    store.verification_tokens.push({
      id: String(id),
      user_id: String(userId),
      token_hash: String(tokenHash),
      expires_at: String(expiresAt),
      created_at: nowIso()
    });
    await persistStore();
    return result([], "INSERT");
  }

  if (normalized === "select user_id, expires_at from verification_tokens where token_hash = $1 limit 1") {
    const tokenHash = String(params[0] ?? "");
    const row = store.verification_tokens.find((entry) => entry.token_hash === tokenHash);
    return result(row ? ([{ user_id: row.user_id, expires_at: row.expires_at }] as unknown as T[]) : []);
  }

  if (normalized === "delete from verification_tokens where token_hash = $1") {
    const tokenHash = String(params[0] ?? "");
    store.verification_tokens = store.verification_tokens.filter((entry) => entry.token_hash !== tokenHash);
    await persistStore();
    return result([], "DELETE");
  }

  if (normalized === "insert into password_reset_tokens (id, user_id, token_hash, expires_at) values ($1, $2, $3, $4)") {
    const [id, userId, tokenHash, expiresAt] = params;
    // One outstanding reset token per user.
    store.password_reset_tokens = store.password_reset_tokens.filter((entry) => entry.user_id !== String(userId));
    store.password_reset_tokens.push({
      id: String(id),
      user_id: String(userId),
      token_hash: String(tokenHash),
      expires_at: String(expiresAt),
      used_at: null,
      created_at: nowIso()
    });
    await persistStore();
    return result([], "INSERT");
  }

  if (normalized === "select user_id, expires_at, used_at from password_reset_tokens where token_hash = $1 limit 1") {
    const tokenHash = String(params[0] ?? "");
    const row = store.password_reset_tokens.find((entry) => entry.token_hash === tokenHash);
    return result(
      row ? ([{ user_id: row.user_id, expires_at: row.expires_at, used_at: row.used_at }] as unknown as T[]) : []
    );
  }

  if (normalized === "update password_reset_tokens set used_at = now() where token_hash = $1") {
    const tokenHash = String(params[0] ?? "");
    const row = store.password_reset_tokens.find((entry) => entry.token_hash === tokenHash);
    if (row) row.used_at = nowIso();
    await persistStore();
    return result([], "UPDATE");
  }

  if (normalized === "update users set email_verified = true, token_version = token_version + 1 where id = $1") {
    const id = String(params[0] ?? "");
    const row = store.users.find((user) => user.id === id);
    if (row) {
      row.email_verified = true;
      row.token_version = row.token_version + 1;
      row.updated_at = nowIso();
    }
    await persistStore();
    return result([], "UPDATE");
  }

  if (normalized === "update users set password_hash = $1, token_version = token_version + 1 where id = $2") {
    const [passwordHash, id] = [String(params[0] ?? ""), String(params[1] ?? "")];
    const row = store.users.find((user) => user.id === id);
    if (row) {
      row.password_hash = passwordHash;
      row.token_version = row.token_version + 1;
      row.updated_at = nowIso();
    }
    await persistStore();
    return result([], "UPDATE");
  }

  throw new Error(`Unsupported file database query: ${text}`);
}

function isConnectionError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const code = (error as Error & { code?: string }).code;
  return Boolean(
    code === "ECONNREFUSED" ||
      code === "ENOTFOUND" ||
      code === "3D000" ||
      code === "28P01" ||
      error.message.includes("connect") ||
      error.message.includes("DATABASE_URL")
  );
}

function getPool() {
  if (!global.__ecoquestPool) {
    global.__ecoquestPool = createPool();
  }

  return global.__ecoquestPool;
}

let migrationPromise: Promise<void> | null = null;

async function ensureMigrations(poolInstance: Pool) {
  if (migrationPromise) {
    return migrationPromise;
  }

  const migrationSql = `
create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key,
  email text not null unique,
  password_hash text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists teams (
  id uuid primary key,
  join_code text not null unique,
  created_by uuid references users(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists team_active_missions (
  id uuid primary key,
  team_id uuid not null references teams(id) on delete cascade,
  mission_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists team_mission_logs (
  id uuid primary key,
  team_id uuid not null references teams(id) on delete cascade,
  mission_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists mission_logs (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists carbon_cache (
  quest_id text primary key,
  carbon_value numeric not null,
  source text not null,
  source_payload jsonb not null default '{}'::jsonb,
  cached_at timestamptz not null default now()
);

create table if not exists photo_hashes (
  id uuid primary key default gen_random_uuid(),
  image_hash text not null unique,
  user_id uuid not null references users(id) on delete cascade,
  quest_id text,
  created_at timestamptz not null default now()
);

create index if not exists idx_teams_join_code on teams(join_code);
create index if not exists idx_team_active_missions_team_id on team_active_missions(team_id);
create index if not exists idx_team_active_missions_mission_id on team_active_missions(mission_id);
create index if not exists idx_team_mission_logs_team_id on team_mission_logs(team_id);
create index if not exists idx_team_mission_logs_mission_id on team_mission_logs(mission_id);
create index if not exists idx_mission_logs_user_id on mission_logs(user_id);
create index if not exists idx_carbon_cache_cached_at on carbon_cache(cached_at);
-- Leaderboard ordering by XP (desc) and team-progress lookup by team + source.
create index if not exists idx_users_xp_desc on users(xp desc);
create index if not exists idx_team_progress_team_source on team_progress(team_id, source);

alter table users
  add column if not exists xp integer not null default 0,
  add column if not exists level integer not null default 1,
  add column if not exists trust_score numeric(5,2) not null default 50;

create table if not exists missions (
  id text primary key,
  title text not null,
  category text not null default 'habits',
  mission_type text not null default 'private',
  visibility text not null default 'private',
  base_xp integer not null default 25,
  repeat_window_seconds integer not null default 86400,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists mission_submissions (
  id uuid primary key default gen_random_uuid(),
  mission_id text not null references missions(id),
  user_id uuid not null references users(id) on delete cascade,
  before_value text,
  after_value text,
  description text not null,
  confidence smallint not null check (confidence between 1 and 5),
  submitted_at timestamptz not null default now(),
  submission_hash text not null unique,
  time_window_key text not null,
  status text not null check (status in ('APPROVED', 'PARTIAL', 'REJECTED', 'FLAGGED')),
  final_xp integer not null default 0 check (final_xp >= 0),
  trust_before numeric(5,2) not null,
  trust_after numeric(5,2) not null,
  ip_hash text,
  user_agent_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, mission_id, time_window_key)
);

create table if not exists private_mission_logs (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique references mission_submissions(id) on delete cascade,
  mission_id text not null references missions(id),
  user_id uuid not null references users(id) on delete cascade,
  before_value text,
  after_value text,
  description text not null,
  self_confidence smallint not null check (self_confidence between 1 and 5),
  logged_at timestamptz not null default now()
);

create table if not exists ai_verification_results (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique references mission_submissions(id) on delete cascade,
  status text not null check (status in ('APPROVED', 'PARTIAL', 'REJECTED', 'FLAGGED')),
  confidence integer not null check (confidence >= 0 and confidence <= 100),
  realism_score integer not null check (realism_score >= 0 and realism_score <= 100),
  reasoning text not null,
  risk_flags jsonb not null default '[]'::jsonb,
  provider text,
  verified_at timestamptz not null default now()
);

create table if not exists team_progress (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  submission_id uuid references mission_submissions(id) on delete set null,
  points integer not null default 0 check (points >= 0),
  source text not null,
  created_at timestamptz not null default now()
);

create table if not exists xp_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  submission_id uuid unique references mission_submissions(id) on delete set null,
  amount integer not null check (amount >= 0),
  reason text not null,
  trust_multiplier numeric(4,2) not null default 1,
  verification_status text not null check (verification_status in ('APPROVED', 'PARTIAL', 'REJECTED', 'FLAGGED')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists trust_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  submission_id uuid references mission_submissions(id) on delete set null,
  previous_score numeric(5,2) not null,
  next_score numeric(5,2) not null,
  delta numeric(5,2) not null,
  reason text not null,
  risk_flags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists impact_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  source text not null,
  amount integer not null check (amount >= 0),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_impact_events_user_created on impact_events(user_id, created_at desc);
create index if not exists idx_impact_events_source on impact_events(source);

-- Shop + team-mission catalogs. The catalog is the source of truth for
-- prices and team-mission rewards: the buy/assign routes look items up by
-- id and ignore any client-supplied price/xp/eco. Seeds mirror the constants
-- in lib/catalog.ts (SHOP_CATALOG / TEAM_MISSION_TEMPLATES) and the file-fallback
-- seeds in EMPTY_STORE — keep all three in sync when editing.
create table if not exists catalog_items (
  mode text not null check (mode in ('plants', 'eggs', 'chests')),
  item_id integer not null,
  name text not null,
  rarity text not null check (rarity in ('common', 'rare', 'epic', 'legendary')),
  price integer not null check (price >= 0),
  image text not null,
  hatch_time text,
  description text,
  sort_order integer not null default 0,
  primary key (mode, item_id)
);

create table if not exists team_mission_templates (
  id text primary key,
  title text not null,
  description text not null,
  icon text not null,
  difficulty text not null check (difficulty in ('Easy', 'Medium', 'Hard')),
  xp integer not null check (xp >= 0),
  eco integer not null check (eco >= 0),
  needed integer not null check (needed >= 1),
  sort_order integer not null default 0
);

insert into missions (id, title, category, mission_type, visibility, base_xp, repeat_window_seconds, metadata)
values
  ('shower_reduce_5min', 'Reduce shower time', 'water', 'private', 'private', 40, 86400, '{"preferredBeforeAfter": true, "unitHint": "minutes"}'::jsonb),
  ('drink_more_water', 'Drink more water', 'health', 'private', 'private', 25, 86400, '{"preferredBeforeAfter": true, "unitHint": "cups or liters"}'::jsonb),
  ('limit_screen_time', 'Limit screen time', 'wellbeing', 'private', 'private', 35, 86400, '{"preferredBeforeAfter": true, "unitHint": "minutes or hours"}'::jsonb)
on conflict (id) do update
set title = excluded.title,
    category = excluded.category,
    mission_type = excluded.mission_type,
    visibility = excluded.visibility,
    base_xp = excluded.base_xp,
    repeat_window_seconds = excluded.repeat_window_seconds,
    metadata = excluded.metadata,
    updated_at = now();

-- Seed catalog_items (mirrors SHOP_CATALOG in lib/catalog.ts).
insert into catalog_items (mode, item_id, name, rarity, price, image, hatch_time, description, sort_order)
values
  ('plants', 1, 'Mossy Fern', 'common', 50, '/images/plants/mint.png', null, null, 0),
  ('plants', 2, 'Golden Daisy', 'common', 60, '/images/plants/sunflower.png', null, null, 1),
  ('plants', 3, 'Blue Orchid', 'rare', 180, '/images/plants/orchid.png', null, null, 2),
  ('plants', 4, 'Spotted Aloe', 'rare', 200, '/images/plants/basil.png', null, null, 3),
  ('plants', 5, 'Mystic Bamboo', 'epic', 450, '/images/plants/bamboo.png', null, null, 4),
  ('plants', 6, 'Crystal Lotus', 'epic', 500, '/images/plants/lotus.png', null, null, 5),
  ('plants', 7, 'Aurora Blossom', 'legendary', 1200, '/images/plants/cherry_blossom.png', null, null, 6),
  ('plants', 8, 'Ember Cactus', 'legendary', 1500, '/images/plants/dragonfruit.png', null, null, 7),
  ('eggs', 1, 'Common Egg', 'common', 100, '/images/eggs/common-egg.png', '1h', null, 0),
  ('eggs', 2, 'Rare Egg', 'rare', 300, '/images/eggs/rare-egg.png', '4h', null, 1),
  ('eggs', 3, 'Epic Egg', 'epic', 700, '/images/eggs/epic-egg.png', '12h', null, 2),
  ('eggs', 4, 'Legendary Egg', 'legendary', 1800, '/images/eggs/legendary-egg.png', '24h', null, 3),
  ('chests', 1, 'Wooden Chest', 'common', 150, '/images/chests/wooden-chest.png', null, 'Contains EcoCoins or Common Plants!', 0),
  ('chests', 2, 'Bronze Chest', 'rare', 350, '/images/chests/bronze-chest.png', null, 'Contains EcoCoins, Rare Plants, or Common Eggs!', 1),
  ('chests', 3, 'Silver Chest', 'epic', 800, '/images/chests/silver-chest.png', null, 'Contains a large amount of EcoCoins, Epic Plants, or Eggs!', 2),
  ('chests', 4, 'Golden Chest', 'legendary', 2000, '/images/chests/golden-chest.png', null, 'Contains massive EcoCoins, Legendary Plants, or Eggs!', 3)
on conflict (mode, item_id) do update
set name = excluded.name,
    rarity = excluded.rarity,
    price = excluded.price,
    image = excluded.image,
    hatch_time = excluded.hatch_time,
    description = excluded.description,
    sort_order = excluded.sort_order;

-- Seed team_mission_templates (mirrors TEAM_MISSION_TEMPLATES in lib/catalog.ts).
insert into team_mission_templates (id, title, description, icon, difficulty, xp, eco, needed, sort_order)
values
  ('t1', 'Recycle 15 Plastic Bottles', 'Split the work and recycle at least 15 plastic bottles as a team.', '♻️', 'Easy', 240, 140, 3, 0),
  ('t2', 'Clean One Shared Area', 'Pick a park block or stairwell and leave it visibly better.', '🧹', 'Easy', 260, 160, 3, 1),
  ('t3', 'Commute Sustainably', 'At least 3 teammates bike, walk or take transit instead of a car.', '🚶', 'Medium', 300, 180, 3, 2),
  ('t4', 'Save 50 Liters of Water', 'Collectively save about 50 liters through shorter showers.', '💧', 'Medium', 320, 190, 3, 3),
  ('t5', 'Night Power Down', 'Unplug unused chargers/devices across at least 3 households.', '🔌', 'Easy', 220, 130, 2, 4),
  ('t6', 'Plant or Care for 3 Greens', 'Plant seeds or tend to three different plants as a joint effort.', '🌱', 'Easy', 210, 120, 3, 5),
  ('t7', 'Zero-Waste Group Feast', 'Organize a group meal where all food ingredients are package-free and zero waste is generated.', '🍽️', 'Hard', 500, 300, 4, 6),
  ('t8', 'Plastic Cleanup Blitz', 'Do a neighborhood walk together and clean up 50 items of plastic waste.', '🚯', 'Medium', 380, 220, 3, 7),
  ('t9', 'Community Energy Audit', 'Inspect and log energy usage parameters in your homes to identify major power-draining sources.', '📊', 'Hard', 550, 340, 4, 8),
  ('t10', 'Shared Compost Starter', 'Set up or refresh a shared compost bin and have teammates add approved food scraps.', 'CP', 'Medium', 420, 250, 3, 9),
  ('t11', 'Reusable Kit Relay', 'Each teammate prepares a reusable bottle, bag, and container kit for the week.', 'RK', 'Easy', 280, 170, 3, 10),
  ('t12', 'Tree Care Patrol', 'Water, mulch, or clean around nearby trees and document care from multiple teammates.', 'TC', 'Medium', 460, 280, 4, 11),
  ('t13', 'Repair Circle', 'Work together to repair clothes, gear, or household items instead of replacing them.', 'RC', 'Hard', 600, 380, 4, 12)
on conflict (id) do update
set title = excluded.title,
    description = excluded.description,
    icon = excluded.icon,
    difficulty = excluded.difficulty,
    xp = excluded.xp,
    eco = excluded.eco,
    needed = excluded.needed,
    sort_order = excluded.sort_order;

create index if not exists idx_missions_type_active on missions(mission_type, active);
create index if not exists idx_mission_submissions_user_submitted on mission_submissions(user_id, submitted_at desc);
create index if not exists idx_mission_submissions_mission on mission_submissions(mission_id);
create index if not exists idx_private_mission_logs_user_logged on private_mission_logs(user_id, logged_at desc);
create index if not exists idx_ai_verification_results_status on ai_verification_results(status);
create index if not exists idx_team_progress_team_created on team_progress(team_id, created_at desc);
create index if not exists idx_xp_transactions_user_created on xp_transactions(user_id, created_at desc);
create index if not exists idx_trust_history_user_created on trust_history(user_id, created_at desc);

-- Auth & account management: email verification + password reset tokens,
-- plus email_verified / token_version on users. Mirrored in
-- db/migrations/007_auth_account_management.sql. Backfill: existing rows get
-- email_verified=true by adding the column with default true, then flipping the
-- default to false for new signups. token_version starts at 0 for everyone.
alter table users
  add column if not exists email_verified boolean not null default true,
  add column if not exists token_version integer not null default 0;
alter table users alter column email_verified set default false;

create table if not exists verification_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_verification_tokens_hash on verification_tokens(token_hash);
create index if not exists idx_verification_tokens_user on verification_tokens(user_id);

create table if not exists password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_password_reset_tokens_hash on password_reset_tokens(token_hash);
create index if not exists idx_password_reset_tokens_user on password_reset_tokens(user_id);
  `;

  migrationPromise = poolInstance.query(migrationSql).then(() => {
    logger.info("Database migrations applied successfully");
  }).catch((err) => {
    migrationPromise = null;
    throw err;
  });

  return migrationPromise;
}

export async function detectMode() {
  if (global.__ecoquestDbMode) {
    return global.__ecoquestDbMode;
  }

  // Return the in-flight promise if detection is already running (prevents race conditions
  // where concurrent requests both enter detection before __ecoquestDbMode is set)
  if (global.__ecoquestDetectModePromise) {
    return global.__ecoquestDetectModePromise;
  }

  const connectionString = getConnectionString();

  if (process.env.LOCAL_DB_MODE === "file") {
    if (!canUseLocalFileStore()) {
      throw missingProductionDatabaseError();
    }

    global.__ecoquestDbMode = "file";
    return global.__ecoquestDbMode;
  }

  if (!connectionString) {
    if (!canUseLocalFileStore()) {
      throw missingProductionDatabaseError();
    }

    global.__ecoquestDbMode = "file";
    return global.__ecoquestDbMode;
  }

  global.__ecoquestDetectModePromise = (async () => {
    try {
      const pool = getPool();
      await pool.query("select 1 as ok");
      await ensureMigrations(pool);
      global.__ecoquestDbMode = "postgres";
    } catch (error) {
      if (!canUseLocalFileStore()) {
        global.__ecoquestDbMode = undefined;
        throw error;
      }

      logError("PostgreSQL unavailable, falling back to local file store", error);
      global.__ecoquestDbMode = "file";
    } finally {
      global.__ecoquestDetectModePromise = undefined;
    }
    return global.__ecoquestDbMode!;
  })();

  return global.__ecoquestDetectModePromise;
}

export async function sql<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  const mode = await detectMode();

  if (mode === "file") {
    return fileSql<T>(text, params);
  }

  try {
    const result = await getPool().query<T>(text, params);
    return {
      command: result.command,
      rowCount: result.rowCount ?? 0,
      rows: result.rows
    };
  } catch (error) {
    if (!canUseLocalFileStore()) {
      throw error;
    }

    global.__ecoquestDbMode = "file";
    logError("PostgreSQL query failed, switching to local file store", error);
    return fileSql<T>(text, params);
  }
}

export async function transaction<T>(
  callback: (query: <R extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) => Promise<QueryResult<R>>) => Promise<T>
) {
  const mode = await detectMode();

  if (mode === "file") {
    return callback(sql);
  }

  const client = await getPool().connect();

  try {
    await client.query("begin");
    const value = await callback(async <R extends QueryResultRow = QueryResultRow>(
      text: string,
      params: unknown[] = []
    ) => {
      const queryResult = await client.query<R>(text, params);
      return {
        command: queryResult.command,
        rowCount: queryResult.rowCount ?? 0,
        rows: queryResult.rows
      };
    });
    await client.query("commit");
    return value;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

// Type of the client-bound `query` fn passed to a `transaction()` callback.
// Exported so helpers (selectUserForUpdate) and callers (grantImpact) can share
// the same signature across module boundaries.
export type DbQuery = <R extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
) => Promise<QueryResult<R>>;

// The base user read used by the impact spine (getUserForImpact in
// lib/impact-service.ts). Reused here so the locked read selects the same
// columns the spine expects, and so file mode hits the existing fileSql branch
// (the exact-match at "select id, email, xp, level, trust_score, payload from
// users where id = $1 limit 1") without needing a new branch.
const SELECT_USER_FOR_IMPACT =
  "select id, email, xp, level, trust_score, payload from users where id = $1 limit 1";

// Read the user row with a FOR UPDATE row lock, on the SAME client-bound `query`
// as the surrounding transaction(). The lock is held until the transaction
// commits, making the caller's read→compute→write atomic against concurrent
// reward grants on the same user row (the lost-update / double-grant class of
// bugs found in the 2026-07-25 reward-route audit).
//
// In file mode (single-user dev fallback) there is no real transaction and no
// row lock, so we run the plain read — which fileSql already handles — and skip
// the FOR UPDATE clause. The "for update" string therefore only ever runs
// against real Postgres (CLAUDE.md option (c): "only run it against real
// Postgres"), so NO new fileSql branch is required.
export async function selectUserForUpdate<T extends QueryResultRow = QueryResultRow>(
  query: DbQuery,
  userId: string
): Promise<QueryResult<T>> {
  const mode = await detectMode();
  if (mode === "file") {
    return query<T>(SELECT_USER_FOR_IMPACT, [userId]);
  }
  return query<T>(SELECT_USER_FOR_IMPACT + " for update", [userId]);
}

// Lock a team_active_missions row on the same client-bound `query` as the
// surrounding transaction(), so the submit_progress read→increment→complete
// sequence is atomic against concurrent submissions on the same mission
// (lost-increment / double-completion class, audit H4). Mirrors
// selectUserForUpdate: in file mode (no real tx / row lock) we run the plain
// read — which fileSql already handles (exact-match at "select payload,
// mission_id from team_active_missions where team_id = $1 and id = $2 limit
// 1") — and skip the FOR UPDATE clause, so no new fileSql branch is needed
// (CLAUDE.md option (c): "only run it against real Postgres").
const SELECT_TEAM_ACTIVE_MISSION =
  "select payload, mission_id from team_active_missions where team_id = $1 and id = $2 limit 1";

export async function selectTeamActiveMissionForUpdate<T extends QueryResultRow = QueryResultRow>(
  query: DbQuery,
  teamId: string,
  id: string
): Promise<QueryResult<T>> {
  const mode = await detectMode();
  if (mode === "file") {
    return query<T>(SELECT_TEAM_ACTIVE_MISSION, [teamId, id]);
  }
  return query<T>(SELECT_TEAM_ACTIVE_MISSION + " for update", [teamId, id]);
}

export const pool = {
  query: sql,
  async end() {
    if (global.__ecoquestPool) {
      await global.__ecoquestPool.end();
      global.__ecoquestPool = undefined;
    }
  }
};
