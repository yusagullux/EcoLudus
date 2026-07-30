import { randomUUID } from "crypto";
import { sql } from "@/lib/db";

type SupportedCollection =
  | "users"
  | "teams"
  | "missionLogs"
  | "activeMissions"
  | "teamMissionLogs";

export type QueryFilter = {
  field: string;
  op: "==";
  value: string | number | boolean | null;
};

type SessionUser = {
  userId: string;
  email: string;
};

type DocRef =
  | { collection: "users"; id: string }
  | { collection: "teams"; id: string }
  | { collection: "activeMissions"; id: string; parentId: string }
  | { collection: "teamMissionLogs"; id: string; parentId: string }
  | { collection: "missionLogs"; id: string };

type CollectionRef =
  | { collection: "users" }
  | { collection: "teams" }
  | { collection: "missionLogs" }
  | { collection: "activeMissions"; parentId: string }
  | { collection: "teamMissionLogs"; parentId: string };

type DocRecord = Record<string, unknown>;

const DELETE_SENTINEL = "__delete_field__";
const INCREMENT_SENTINEL = "__increment__";

/**
 * The ONLY fields a client may write on its own `users` document through the
 * /api/store RPC (setDoc / updateDoc / addDoc). Everything else — the entire
 * economy (xp, level, ecoPoints, impact, carbonReduced, treesPlanted,
 * missionsCompleted, trustScore), inventory (eggs, chests, milestone_*),
 * streak/claim gates (lastStreakRewardDay, claimedSocialRewards), and the
 * photo-verification map (verifiedQuestProofs, written only by the locked
 * /api/quests/verify route) — is mintable only through locked server routes
 * (grantImpact, shop/buy, chests/open, …). Without this gate a client could
 * `updateDoc({ ecoPoints: { __op: "__increment__", value: 99999 } })` or
 * `setDoc({ xp: 999999 })` and mint the whole economy in one call, or forge a
 * `verifiedQuestProofs` entry to bypass Gemini photo verification — making
 * every locked reward route pointless (audit findings C1 + H7).
 *
 * The transitional fields that were once client-authoritative (animals,
 * activePet, garden, plants, seeds, currentDailyQuests, dailyQuestsCompleted,
 * lastQuestResetTime) are now server-authoritative — Phase 3 moved each to a
 * locked server route (/api/garden/plant|remove, /api/pets/select,
 * /api/quests/daily), so they have left the allowlist. A client can no longer
 * forge a legendary onto a tile, max a pet's stats, or rig the daily quest set;
 * the only client-writable user fields now are cosmetic/profile ones.
 */
const CLIENT_WRITABLE_USER_FIELDS = new Set<string>([
  // Cosmetic / profile (permanent) — the only client-writable user fields.
  "displayName",
  "profileImage",
  "settings",
  "theme",
  "preferences"
]);

/**
 * Returns a shallow copy of `data` keeping only the allowlisted top-level user
 * fields, and dropping any value that is a `{ __op }` sentinel object — clients
 * must never send field-transform sentinels; integer deltas are minted only by
 * locked server routes. Non-allowlisted keys (the entire economy) are dropped.
 */
function filterClientUserFields(data: DocRecord): DocRecord {
  const allowed: DocRecord = {};
  for (const [key, value] of Object.entries(data)) {
    if (!CLIENT_WRITABLE_USER_FIELDS.has(key)) {
      continue;
    }
    if (value && typeof value === "object" && !Array.isArray(value) && "__op" in (value as Record<string, unknown>)) {
      // Reject field-transform sentinels from clients.
      continue;
    }
    allowed[key] = value;
  }
  return allowed;
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function getByPath(source: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (current && typeof current === "object") {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, source);
}

function setByPath(target: DocRecord, path: string, value: unknown): void {
  const keys = path.split(".");
  let cursor: DocRecord = target;

  for (let index = 0; index < keys.length - 1; index += 1) {
    const key = keys[index];
    const nextValue = cursor[key];

    if (!nextValue || typeof nextValue !== "object" || Array.isArray(nextValue)) {
      cursor[key] = {};
    }

    cursor = cursor[key] as DocRecord;
  }

  cursor[keys[keys.length - 1]] = value;
}

function deleteByPath(target: DocRecord, path: string): void {
  const keys = path.split(".");
  let cursor: DocRecord = target;

  for (let index = 0; index < keys.length - 1; index += 1) {
    const key = keys[index];
    const nextValue = cursor[key];
    if (!nextValue || typeof nextValue !== "object" || Array.isArray(nextValue)) {
      return;
    }
    cursor = nextValue as DocRecord;
  }

  delete cursor[keys[keys.length - 1]];
}

function applyPatch(payload: DocRecord, patch: DocRecord): DocRecord {
  const nextPayload = deepClone(payload);

  for (const [key, value] of Object.entries(patch)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const record = value as Record<string, unknown>;
      if (record.__op === DELETE_SENTINEL) {
        deleteByPath(nextPayload, key);
        continue;
      }
      if (record.__op === INCREMENT_SENTINEL) {
        const currentValue = Number(getByPath(nextPayload, key) ?? 0);
        const incrementBy = Number(record.value ?? 0);
        setByPath(nextPayload, key, currentValue + incrementBy);
        continue;
      }
    }

    setByPath(nextPayload, key, value);
  }

  return nextPayload;
}

function parseDocPath(path: string[]): DocRef {
  if (path[0] === "users" && path.length === 2) {
    return { collection: "users", id: path[1] };
  }

  if (path[0] === "teams" && path.length === 2) {
    return { collection: "teams", id: path[1] };
  }

  if (path[0] === "teams" && path[2] === "activeMissions" && path.length === 4) {
    return { collection: "activeMissions", id: path[3], parentId: path[1] };
  }

  if (path[0] === "teams" && path[2] === "missionLogs" && path.length === 4) {
    return { collection: "teamMissionLogs", id: path[3], parentId: path[1] };
  }

  if (path[0] === "missionLogs" && path.length === 2) {
    return { collection: "missionLogs", id: path[1] };
  }

  throw new Error(`Unsupported document path: ${path.join("/")}`);
}

function parseCollectionPath(path: string[]): CollectionRef {
  if (path.length === 1 && path[0] === "users") {
    return { collection: "users" };
  }

  if (path.length === 1 && path[0] === "teams") {
    return { collection: "teams" };
  }

  if (path.length === 1 && path[0] === "missionLogs") {
    return { collection: "missionLogs" };
  }

  if (path.length === 3 && path[0] === "teams" && path[2] === "activeMissions") {
    return { collection: "activeMissions", parentId: path[1] };
  }

  if (path.length === 3 && path[0] === "teams" && path[2] === "missionLogs") {
    return { collection: "teamMissionLogs", parentId: path[1] };
  }

  throw new Error(`Unsupported collection path: ${path.join("/")}`);
}

function ensureAuthenticated(session: SessionUser | null): asserts session is SessionUser {
  if (!session) {
    throw new Error("auth/unauthenticated");
  }
}

function sanitizeUserPayload(id: string, email: string, payload: DocRecord | null): DocRecord {
  return {
    ...(payload ?? {}),
    email,
    id
  };
}

// Public projection of a user for list endpoints (getDocs(["users"]) → friends
// page, leaderboards). Returns ONLY the public display fields — never the full
// payload, never the email. The full payload (own profile) still goes through
// sanitizeUserPayload via readUser/getDoc; this is the least-privilege view for
// listing OTHER users. Trimming here closes the over-disclosure where any
// authenticated user could read every other user's full game state + email.
function publicUserProjection(id: string, payload: DocRecord | null): DocRecord {
  const p = (payload ?? {}) as Record<string, unknown>;
  return {
    id,
    displayName: (p.displayName as string) || "Anonymous",
    xp: Number(p.xp ?? 0),
    level: Number(p.level ?? 1),
    ecoPoints: Number(p.ecoPoints ?? 0),
    profileImage: (p.profileImage as string | null) || null
  };
}

async function readUser(id: string): Promise<DocRecord | null> {
  const result = await sql("select id, email, payload from users where id = $1 limit 1", [id]);
  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return sanitizeUserPayload(row.id, row.email, row.payload);
}

async function readTeam(id: string): Promise<DocRecord | null> {
  const result = await sql("select id, join_code, payload from teams where id = $1 limit 1", [id]);
  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    ...(row.payload as DocRecord | null ?? {}),
    joinCode: row.join_code
  };
}

async function readTeamSubdoc(
  table: "team_active_missions" | "team_mission_logs",
  teamId: string,
  id: string
): Promise<DocRecord | null> {
  if (table === "team_active_missions") {
    const result = await sql(
      "select payload from team_active_missions where team_id = $1 and id = $2 limit 1",
      [teamId, id]
    );
    return (result.rows[0]?.payload as DocRecord | null) ?? null;
  }
  const result = await sql(
    "select payload from team_mission_logs where team_id = $1 and id = $2 limit 1",
    [teamId, id]
  );
  return (result.rows[0]?.payload as DocRecord | null) ?? null;
}

async function readMissionLog(id: string): Promise<DocRecord | null> {
  const result = await sql("select payload from mission_logs where id = $1 limit 1", [id]);
  return (result.rows[0]?.payload as DocRecord | null) ?? null;
}

function canAccessTeamPayload(payload: DocRecord, session: SessionUser): boolean {
  const members = payload.members;
  if (!members || typeof members !== "object" || Array.isArray(members)) {
    return false;
  }

  return Boolean((members as Record<string, unknown>)[session.userId]);
}

export async function getDocument(path: string[], session: SessionUser | null): Promise<DocRecord | null> {
  ensureAuthenticated(session);
  const ref = parseDocPath(path);

  if (ref.collection === "users") {
    if (ref.id !== session.userId) {
      throw new Error("permission-denied");
    }
    return readUser(ref.id);
  }

  if (ref.collection === "teams") {
    const team = await readTeam(ref.id);
    if (!team) {
      return null;
    }
    if (!canAccessTeamPayload(team, session)) {
      throw new Error("permission-denied");
    }
    return team;
  }

  if (ref.collection === "activeMissions") {
    const team = await readTeam(ref.parentId);
    if (!team || !canAccessTeamPayload(team, session)) {
      throw new Error("permission-denied");
    }
    return readTeamSubdoc("team_active_missions", ref.parentId, ref.id);
  }

  if (ref.collection === "teamMissionLogs") {
    const team = await readTeam(ref.parentId);
    if (!team || !canAccessTeamPayload(team, session)) {
      throw new Error("permission-denied");
    }
    return readTeamSubdoc("team_mission_logs", ref.parentId, ref.id);
  }

  const log = await readMissionLog(ref.id);
  if (!log) {
    return null;
  }
  if (log.userId && log.userId !== session.userId) {
    throw new Error("permission-denied");
  }
  return log;
}

export async function setDocument(
  path: string[],
  data: DocRecord,
  session: SessionUser | null
): Promise<void> {
  ensureAuthenticated(session);
  const ref = parseDocPath(path);

  if (ref.collection === "users") {
    if (ref.id !== session.userId) {
      throw new Error("permission-denied");
    }

    // Merge, don't replace: start from the existing payload (preserving the
    // entire economy — xp/level/ecoPoints/impact/inventory/milestones — which the
    // client is not allowed to overwrite) and overlay only the client-writable
    // fields from `data`. This keeps a client `setDoc`/`addDoc` on its own user
    // doc (or an `updateDoc` whose reconstructed payload carries the full blob)
    // from minting or wiping economy state. See C1 in the audit.
    const existing = await readUser(ref.id);
    const base: DocRecord = existing ?? {};
    const payload: DocRecord = {
      ...base,
      ...filterClientUserFields(data),
      email: session.email,
      // Preserve the canonical id/identity if base had them.
      ...(base.id ? { id: base.id } : {})
    };

    const xpVal = Number(payload.xp ?? 0);
    const levelVal = Number(payload.level ?? 1);
    const trustScoreVal = Number(payload.trustScore ?? payload.trust_score ?? 50);

    await sql(
      `insert into users (id, email, password_hash, xp, level, trust_score, payload)
       values ($1, $2, coalesce((select password_hash from users where id = $1), ''), $4, $5, $6, $3::jsonb)
       on conflict (id) do update
       set email = excluded.email,
           xp = excluded.xp,
           level = excluded.level,
           trust_score = excluded.trust_score,
           payload = excluded.payload,
           updated_at = now()`,
      [ref.id, session.email, JSON.stringify(payload), xpVal, levelVal, trustScoreVal]
    );
    return;
  }

  if (ref.collection === "teams") {
    // Membership is owned by /api/teams (team_active_missions rows), not by
    // this document-store path. Only an EXISTING member may write team
    // metadata here, and the `members` map is never accepted from the client
    // — otherwise a caller could self-grant membership by sending
    // { members: { [theirUserId]: true } } and then read/write team subdocs.
    const existing = await readTeam(ref.id);
    if (!existing || !canAccessTeamPayload(existing, session)) {
      throw new Error("permission-denied");
    }

    const { members: _dropMembers, ...rest } = data;
    const payload: DocRecord = { ...rest, members: existing.members ?? {} };

    await sql(
      `insert into teams (id, join_code, created_by, payload)
       values ($1, $2, $3, $4::jsonb)
       on conflict (id) do update
       set join_code = excluded.join_code,
           payload = excluded.payload,
           updated_at = now()`,
      // created_by ($3) only applies on insert; on conflict it is preserved
      // (not in the SET list).
      [ref.id, String(data.joinCode ?? existing.joinCode ?? ""), session.userId, JSON.stringify(payload)]
    );
    return;
  }

  if (ref.collection === "activeMissions") {
    const team = await readTeam(ref.parentId);
    if (!team || !canAccessTeamPayload(team, session)) {
      throw new Error("permission-denied");
    }

    await sql(
      `insert into team_active_missions (id, team_id, mission_id, payload)
       values ($1, $2, $3, $4::jsonb)
       on conflict (id) do update
       set mission_id = excluded.mission_id,
           payload = excluded.payload,
           updated_at = now()`,
      [ref.id, ref.parentId, String(data.missionId ?? ""), JSON.stringify(data)]
    );
    return;
  }

  if (ref.collection === "teamMissionLogs") {
    const team = await readTeam(ref.parentId);
    if (!team || !canAccessTeamPayload(team, session)) {
      throw new Error("permission-denied");
    }

    await sql(
      `insert into team_mission_logs (id, team_id, mission_id, payload)
       values ($1, $2, $3, $4::jsonb)
       on conflict (id) do update
       set mission_id = excluded.mission_id,
           payload = excluded.payload`,
      [ref.id, ref.parentId, String(data.missionId ?? ""), JSON.stringify(data)]
    );
    return;
  }

  await sql(
    `insert into mission_logs (id, user_id, payload)
     values ($1, $2, $3::jsonb)
     on conflict (id) do update
     set user_id = excluded.user_id,
         payload = excluded.payload`,
    [ref.id, session.userId, JSON.stringify({ ...data, userId: session.userId })]
  );
}

export async function updateDocument(
  path: string[],
  updates: DocRecord,
  session: SessionUser | null
): Promise<void> {
  ensureAuthenticated(session);
  const ref = parseDocPath(path);
  const current = await getDocument(path, session);
  if (!current) {
    throw new Error("not-found");
  }

  // For the user document, strip the patch to client-writable fields before
  // running applyPatch so a client-supplied `__op` sentinel on an economy
  // field (xp/ecoPoints/impact/…) can never execute. setDocument re-merges
  // against the live row afterward, so concurrent reward grants to the same
  // user are not clobbered by this read-modify-write either.
  const safeUpdates = ref.collection === "users" ? filterClientUserFields(updates) : updates;

  const next = applyPatch(current, safeUpdates);
  await setDocument(path, next, session);
}

export async function deleteDocument(path: string[], session: SessionUser | null): Promise<void> {
  ensureAuthenticated(session);
  const ref = parseDocPath(path);

  if (ref.collection === "users") {
    if (ref.id !== session.userId) {
      throw new Error("permission-denied");
    }
    await sql("delete from users where id = $1", [ref.id]);
    return;
  }

  if (ref.collection === "teams") {
    const team = await readTeam(ref.id);
    if (!team || !canAccessTeamPayload(team, session)) {
      throw new Error("permission-denied");
    }
    await sql("delete from teams where id = $1", [ref.id]);
    return;
  }

  if (ref.collection === "activeMissions") {
    const team = await readTeam(ref.parentId);
    if (!team || !canAccessTeamPayload(team, session)) {
      throw new Error("permission-denied");
    }
    await sql("delete from team_active_missions where team_id = $1 and id = $2", [ref.parentId, ref.id]);
    return;
  }

  if (ref.collection === "teamMissionLogs") {
    const team = await readTeam(ref.parentId);
    if (!team || !canAccessTeamPayload(team, session)) {
      throw new Error("permission-denied");
    }
    await sql("delete from team_mission_logs where team_id = $1 and id = $2", [ref.parentId, ref.id]);
    return;
  }

  await sql("delete from mission_logs where id = $1 and user_id = $2", [ref.id, session.userId]);
}

export async function addDocument(
  collectionPath: string[],
  data: DocRecord,
  session: SessionUser | null
): Promise<{ id: string }> {
  const collection = parseCollectionPath(collectionPath);
  const id = randomUUID();

  if (collection.collection === "activeMissions") {
    await setDocument(["teams", collection.parentId, "activeMissions", id], data, session);
    return { id };
  }

  if (collection.collection === "teamMissionLogs") {
    await setDocument(["teams", collection.parentId, "missionLogs", id], data, session);
    return { id };
  }

  await setDocument([collection.collection, id], data, session);
  return { id };
}

export async function listDocuments(
  collectionPath: string[],
  filters: QueryFilter[],
  maxResults: number | null | undefined,
  session: SessionUser | null
): Promise<Array<{ id: string; data: DocRecord }>> {
  ensureAuthenticated(session);
  const collection = parseCollectionPath(collectionPath);
  const limitValue = Math.max(1, Math.min(maxResults ?? 100, 500));

  if (collection.collection === "users") {
    const result = await sql("select id, email, payload from users order by created_at asc limit $1", [limitValue]);

    return result.rows.map((row) => ({
      id: row.id,
      data: publicUserProjection(row.id, row.payload)
    }));
  }

  if (collection.collection === "teams") {
    let queryText = "select id, join_code, payload from teams";
    const params: unknown[] = [];

    if (filters.length === 1 && filters[0]?.field === "joinCode" && filters[0]?.op === "==") {
      params.push(String(filters[0].value ?? ""));
      queryText += ` where join_code = $${params.length}`;
    }

    params.push(limitValue);
    queryText += ` order by created_at desc limit $${params.length}`;

    const result = await sql(queryText, params);

    return result.rows
      .map((row) => ({
        id: row.id,
        data: {
          ...(row.payload as DocRecord | null ?? {}),
          joinCode: row.join_code
        } as DocRecord
      }))
      .filter(
        (row) => canAccessTeamPayload(row.data, session) || filters.some((filter) => filter.field === "joinCode")
      );
  }

  if (collection.collection === "activeMissions") {
    const team = await readTeam(collection.parentId);
    if (!team || !canAccessTeamPayload(team, session)) {
      throw new Error("permission-denied");
    }

    const result = await sql(
      "select id, payload from team_active_missions where team_id = $1 order by created_at desc limit $2",
      [collection.parentId, limitValue]
    );

    return result.rows.map((row) => ({
      id: row.id,
      data: (row.payload as DocRecord | null) ?? {}
    }));
  }

  if (collection.collection === "teamMissionLogs") {
    const team = await readTeam(collection.parentId);
    if (!team || !canAccessTeamPayload(team, session)) {
      throw new Error("permission-denied");
    }

    let queryText = "select id, payload from team_mission_logs where team_id = $1";
    const params: unknown[] = [collection.parentId];

    if (filters.length === 1 && filters[0]?.field === "missionId" && filters[0]?.op === "==") {
      params.push(String(filters[0].value ?? ""));
      queryText += ` and mission_id = $${params.length}`;
    }

    params.push(limitValue);
    queryText += ` order by created_at desc limit $${params.length}`;

    const result = await sql(queryText, params);
    return result.rows.map((row) => ({
      id: row.id,
      data: (row.payload as DocRecord | null) ?? {}
    }));
  }

  const result = await sql(
    "select id, payload from mission_logs where user_id = $1 order by created_at desc limit $2",
    [session.userId, limitValue]
  );

  return result.rows.map((row) => ({
    id: row.id,
    data: (row.payload as DocRecord | null) ?? {}
  }));
}

// `SupportedCollection` is exported for callers that branch on the same set of
// collection names (e.g. the /api/store route's discriminated validation).
export type { SupportedCollection };