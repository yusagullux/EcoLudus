// @ts-nocheck
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

const DELETE_SENTINEL = "__delete_field__";
const INCREMENT_SENTINEL = "__increment__";

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getByPath(source, path) {
  return path.split(".").reduce((current, key) => {
    if (current && typeof current === "object") {
      return current[key];
    }
    return undefined;
  }, source);
}

function setByPath(target, path, value) {
  const keys = path.split(".");
  let cursor = target;

  for (let index = 0; index < keys.length - 1; index += 1) {
    const key = keys[index];
    const nextValue = cursor[key];

    if (!nextValue || typeof nextValue !== "object" || Array.isArray(nextValue)) {
      cursor[key] = {};
    }

    cursor = cursor[key];
  }

  cursor[keys[keys.length - 1]] = value;
}

function deleteByPath(target, path) {
  const keys = path.split(".");
  let cursor = target;

  for (let index = 0; index < keys.length - 1; index += 1) {
    const key = keys[index];
    const nextValue = cursor[key];
    if (!nextValue || typeof nextValue !== "object" || Array.isArray(nextValue)) {
      return;
    }
    cursor = nextValue;
  }

  delete cursor[keys[keys.length - 1]];
}

function applyPatch(payload, patch) {
  const nextPayload = deepClone(payload);

  for (const [key, value] of Object.entries(patch)) {
    if (value && typeof value === "object" && !Array.isArray(value) && value.__op === DELETE_SENTINEL) {
      deleteByPath(nextPayload, key);
      continue;
    }

    if (value && typeof value === "object" && !Array.isArray(value) && value.__op === INCREMENT_SENTINEL) {
      const currentValue = Number(getByPath(nextPayload, key) ?? 0);
      const incrementBy = Number(value.value ?? 0);
      setByPath(nextPayload, key, currentValue + incrementBy);
      continue;
    }

    setByPath(nextPayload, key, value);
  }

  return nextPayload;
}

function parseDocPath(path) {
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

function parseCollectionPath(path) {
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

function sanitizeUserPayload(id, email, payload) {
  return {
    ...payload,
    email,
    id
  };
}

async function readUser(id) {
  const result = await sql("select id, email, payload from users where id = $1 limit 1", [id]);
  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return sanitizeUserPayload(row.id, row.email, row.payload);
}

async function readTeam(id) {
  const result = await sql("select id, join_code, payload from teams where id = $1 limit 1", [id]);
  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    ...row.payload,
    joinCode: row.join_code
  };
}

async function readTeamSubdoc(table: "team_active_missions" | "team_mission_logs", teamId, id) {
  if (table === "team_active_missions") {
    const result = await sql("select payload from team_active_missions where team_id = $1 and id = $2 limit 1", [teamId, id]);
    return result.rows[0]?.payload ?? null;
  }
  const result = await sql("select payload from team_mission_logs where team_id = $1 and id = $2 limit 1", [teamId, id]);
  return result.rows[0]?.payload ?? null;
}

async function readMissionLog(id) {
  const result = await sql("select payload from mission_logs where id = $1 limit 1", [id]);
  return result.rows[0]?.payload ?? null;
}

function canAccessTeamPayload(payload, session) {
  const members = payload.members;
  if (!members || typeof members !== "object" || Array.isArray(members)) {
    return false;
  }

  return Boolean(members[session.userId]);
}

export async function getDocument(path, session) {
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

export async function setDocument(path, data, session) {
  ensureAuthenticated(session);
  const ref = parseDocPath(path);

  if (ref.collection === "users") {
    if (ref.id !== session.userId) {
      throw new Error("permission-denied");
    }

    const payload = {
      ...data,
      email: session.email
    };

    await sql(
      `insert into users (id, email, password_hash, payload)
       values ($1, $2, coalesce((select password_hash from users where id = $1), ''), $3::jsonb)
       on conflict (id) do update
       set email = excluded.email,
           payload = excluded.payload,
           updated_at = now()`,
      [ref.id, session.email, JSON.stringify(payload)]
    );
    return;
  }

  if (ref.collection === "teams") {
    const members = data.members;
    const isMember =
      members &&
      typeof members === "object" &&
      !Array.isArray(members) &&
      Boolean(members[session.userId]);

    if (!isMember) {
      throw new Error("permission-denied");
    }

    await sql(
      `insert into teams (id, join_code, created_by, payload)
       values ($1, $2, $3, $4::jsonb)
       on conflict (id) do update
       set join_code = excluded.join_code,
           payload = excluded.payload,
           updated_at = now()`,
      [ref.id, String(data.joinCode ?? ""), session.userId, JSON.stringify(data)]
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

export async function updateDocument(path, updates, session) {
  ensureAuthenticated(session);
  const current = await getDocument(path, session);
  if (!current) {
    throw new Error("not-found");
  }

  const next = applyPatch(current, updates);
  await setDocument(path, next, session);
}

export async function deleteDocument(path, session) {
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

export async function addDocument(collectionPath, data, session) {
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

export async function listDocuments(collectionPath, filters, maxResults, session) {
  ensureAuthenticated(session);
  const collection = parseCollectionPath(collectionPath);
  const limitValue = Math.max(1, Math.min(maxResults ?? 100, 500));

  if (collection.collection === "users") {
    const result = await sql("select id, email, payload from users order by created_at asc limit $1", [limitValue]);

    return result.rows.map((row) => ({
      id: row.id,
      data: sanitizeUserPayload(row.id, row.email, row.payload)
    }));
  }

  if (collection.collection === "teams") {
    let queryText = "select id, join_code, payload from teams";
    const params = [];

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
          ...row.payload,
          joinCode: row.join_code
        }
      }))
      .filter((row) => canAccessTeamPayload(row.data, session) || filters.some((filter) => filter.field === "joinCode"));
  }

  if (collection.collection === "activeMissions") {
    const team = await readTeam(collection.parentId);
    if (!team || !canAccessTeamPayload(team, session)) {
      throw new Error("permission-denied");
    }

    const result = await sql("select id, payload from team_active_missions where team_id = $1 order by created_at desc limit $2", [
      collection.parentId,
      limitValue
    ]);

    return result.rows.map((row) => ({
      id: row.id,
      data: row.payload
    }));
  }

  if (collection.collection === "teamMissionLogs") {
    const team = await readTeam(collection.parentId);
    if (!team || !canAccessTeamPayload(team, session)) {
      throw new Error("permission-denied");
    }

    let queryText = "select id, payload from team_mission_logs where team_id = $1";
    const params = [collection.parentId];

    if (filters.length === 1 && filters[0]?.field === "missionId" && filters[0]?.op === "==") {
      params.push(String(filters[0].value ?? ""));
      queryText += ` and mission_id = $${params.length}`;
    }

    params.push(limitValue);
    queryText += ` order by created_at desc limit $${params.length}`;

    const result = await sql(queryText, params);
    return result.rows.map((row) => ({
      id: row.id,
      data: row.payload
    }));
  }

  const result = await sql("select id, payload from mission_logs where user_id = $1 order by created_at desc limit $2", [
    session.userId,
    limitValue
  ]);

  return result.rows.map((row) => ({
    id: row.id,
    data: row.payload
  }));
}
