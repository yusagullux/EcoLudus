// @ts-nocheck
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { Pool, type QueryResultRow } from "pg";

type QueryResult<T extends QueryResultRow = QueryResultRow> = {
  command: string;
  rowCount: number;
  rows: T[];
};

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
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
};

declare global {
  // eslint-disable-next-line no-var
  var __ecoquestPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __ecoquestDbMode: "postgres" | "file" | undefined;
  // eslint-disable-next-line no-var
  var __ecoquestStore: FileStore | undefined;
  // eslint-disable-next-line no-var
  var __ecoquestStoreWrite: Promise<void> | undefined;
  // eslint-disable-next-line no-var
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
  trust_history: []
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

async function loadStore() {
  if (global.__ecoquestStore) {
    return global.__ecoquestStore;
  }

  await ensureStoreDir();

  try {
    const raw = await readFile(STORE_PATH, "utf8");
    global.__ecoquestStore = {
      ...clone(EMPTY_STORE),
      ...JSON.parse(raw)
    };
  } catch {
    global.__ecoquestStore = clone(EMPTY_STORE);
    await writeFile(STORE_PATH, JSON.stringify(global.__ecoquestStore, null, 2), "utf8");
  }

  return global.__ecoquestStore;
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
    return result([{ ok: 1 } as T]);
  }

  if (normalized === "select id from users where email = $1 limit 1") {
    const email = String(params[0] ?? "");
    const row = store.users.find((user) => user.email === email);
    return result(row ? ([{ id: row.id }] as T[]) : []);
  }

  if (normalized === "select id, email, password_hash, payload from users where email = $1 limit 1") {
    const email = String(params[0] ?? "");
    const row = store.users.find((user) => user.email === email);
    return result(row ? ([clone(row)] as T[]) : []);
  }

  if (normalized === "select id, email, payload from users where id = $1 limit 1") {
    const id = String(params[0] ?? "");
    const row = store.users.find((user) => user.id === id);
    return result(row ? ([{ id: row.id, email: row.email, payload: clone(row.payload) }] as T[]) : []);
  }

  if (normalized === "select id, email, xp, level, trust_score, payload from users where id = $1 limit 1") {
    const id = String(params[0] ?? "");
    const row = store.users.find((user) => user.id === id);
    if (!row) return result([] as T[]);
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
      ] as T[]
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
    return result(rows as T[]);
  }

  if (normalized === "select id, join_code, payload from teams where id = $1 limit 1") {
    const id = String(params[0] ?? "");
    const row = store.teams.find((team) => team.id === id);
    return result(
      row ? ([{ id: row.id, join_code: row.join_code, payload: clone(row.payload) }] as T[]) : []
    );
  }

  if (normalized === "select id, join_code, created_by, payload from teams where id = (select team_id from team_active_missions where payload->>'user_id' = $1 limit 1)") {
    const userId = String(params[0] ?? "");
    const teamActiveMission = store.team_active_missions.find((tam) => (tam.payload as any)?.user_id === userId);
    if (!teamActiveMission) {
      return result([] as T[]);
    }
    const row = store.teams.find((team) => team.id === teamActiveMission.team_id);
    return result(
      row ? ([{ id: row.id, join_code: row.join_code, created_by: row.created_by, payload: clone(row.payload) }] as T[]) : []
    );
  }

  if (normalized === "select id, payload from teams where join_code = $1 limit 1") {
    const joinCode = String(params[0] ?? "");
    const row = store.teams.find((team) => team.join_code === joinCode);
    return result(
      row ? ([{ id: row.id, payload: clone(row.payload) }] as T[]) : []
    );
  }

  if (normalized === "select payload from team_active_missions where team_id = $1 and id = $2 limit 1") {
    const [teamId, id] = [String(params[0] ?? ""), String(params[1] ?? "")];
    const row = store.team_active_missions.find((entry) => entry.team_id === teamId && entry.id === id);
    return result(row ? ([{ payload: clone(row.payload) }] as T[]) : []);
  }

  if (normalized === "select payload, mission_id from team_active_missions where team_id = $1 and id = $2 limit 1") {
    const [teamId, id] = [String(params[0] ?? ""), String(params[1] ?? "")];
    const row = store.team_active_missions.find((entry) => entry.team_id === teamId && entry.id === id);
    return result(row ? ([{ payload: clone(row.payload), mission_id: row.mission_id }] as T[]) : []);
  }

  if (normalized === "select count(*) as count from team_active_missions where team_id = $1 and mission_id is not null") {
    const teamId = String(params[0] ?? "");
    const count = store.team_active_missions.filter(
      (entry) => entry.team_id === teamId && entry.mission_id !== null
    ).length;
    return result([{ count }] as T[]);
  }

  if (normalized === "select id from team_active_missions where team_id = $1 and mission_id = $2 limit 1") {
    const [teamId, missionId] = [String(params[0] ?? ""), String(params[1] ?? "")];
    const row = store.team_active_missions.find(
      (entry) => entry.team_id === teamId && entry.mission_id === missionId
    );
    return result(row ? ([{ id: row.id }] as T[]) : []);
  }

  if (normalized === "select payload from team_mission_logs where team_id = $1 and id = $2 limit 1") {
    const [teamId, id] = [String(params[0] ?? ""), String(params[1] ?? "")];
    const row = store.team_mission_logs.find((entry) => entry.team_id === teamId && entry.id === id);
    return result(row ? ([{ payload: clone(row.payload) }] as T[]) : []);
  }

  if (normalized === "select payload from mission_logs where id = $1 limit 1") {
    const id = String(params[0] ?? "");
    const row = store.mission_logs.find((entry) => entry.id === id);
    return result(row ? ([{ payload: clone(row.payload) }] as T[]) : []);
  }

  if (normalized === "select id, user_id, payload from mission_logs") {
    const rows = store.mission_logs.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      payload: clone(row.payload)
    }));
    return result(rows as T[]);
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
    return result(row ? ([clone(row)] as T[]) : []);
  }

  if (normalized === "select id, image_hash, user_id, quest_id, created_at from photo_hashes where image_hash = $1 limit 1") {
    const hash = String(params[0] ?? "");
    const row = store.photo_hashes.find((entry) => entry.image_hash === hash);
    return result(row ? ([clone(row)] as T[]) : []);
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
          ] as T[])
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
    return result([{ count }] as T[]);
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
    return result([{ count: missionIds.size }] as T[]);
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
    return result(rows as T[]);
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
    return result([{ id: newId }] as T[], "INSERT");
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

  if (normalized === "delete from users where id = $1") {
    const id = String(params[0] ?? "");
    store.users = store.users.filter((user) => user.id !== id);
    await persistStore();
    return result([], "DELETE");
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

    return result(rows as T[]);
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
    return result(rows as T[]);
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
    return result([{ total_xp: totalXp, total_eco: totalEco, member_count: users.length }] as T[]);
  }

  if (normalized === "select count(*) as missions_completed from team_mission_logs where team_id = $1") {
    const teamId = String(params[0] ?? "");
    const count = store.team_mission_logs.filter((entry) => entry.team_id === teamId).length;
    return result([{ missions_completed: count }] as T[]);
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
    return result(rows as T[]);
  }

  if (normalized === "select team_id from team_active_missions where payload->>'user_id' = $1 limit 1") {
    const userId = String(params[0] ?? "");
    const row = store.team_active_missions.find((tam) => (tam.payload as any)?.user_id === userId);
    return result(row ? ([{ team_id: row.team_id }] as T[]) : []);
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

    return result(rows as T[]);
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

    return result(rows as T[]);
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

    return result(rows as T[]);
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

    return result(rows as T[]);
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

    return result(rows as T[]);
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

    return result(rows as T[]);
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

create index if not exists idx_missions_type_active on missions(mission_type, active);
create index if not exists idx_mission_submissions_user_submitted on mission_submissions(user_id, submitted_at desc);
create index if not exists idx_mission_submissions_mission on mission_submissions(mission_id);
create index if not exists idx_private_mission_logs_user_logged on private_mission_logs(user_id, logged_at desc);
create index if not exists idx_ai_verification_results_status on ai_verification_results(status);
create index if not exists idx_team_progress_team_created on team_progress(team_id, created_at desc);
create index if not exists idx_xp_transactions_user_created on xp_transactions(user_id, created_at desc);
create index if not exists idx_trust_history_user_created on trust_history(user_id, created_at desc);
  `;

  migrationPromise = poolInstance.query(migrationSql).then(() => {
    console.log("Database migrations applied successfully.");
  }).catch((err) => {
    migrationPromise = null;
    throw err;
  });

  return migrationPromise;
}

async function detectMode() {
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

      console.warn("PostgreSQL unavailable, falling back to local persistent data store. Error:", error);
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
    console.warn("PostgreSQL query failed, switching to local persistent data store. Error:", error);
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

export const pool = {
  query: sql,
  async end() {
    if (global.__ecoquestPool) {
      await global.__ecoquestPool.end();
      global.__ecoquestPool = undefined;
    }
  }
};
