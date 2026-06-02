function buildRef(kind, path) {
    return { kind, path };
}

function ensurePathArray(ref) {
    if (!ref || !Array.isArray(ref.path)) {
        throw new Error("Invalid document reference");
    }

    return ref.path;
}

async function callFirestore(operation) {
    const response = await fetch("/api/firestore", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify(operation)
    });

    const payload = await response.json();

    if (!response.ok) {
        const error = new Error(payload?.error?.code || "Firestore compatibility request failed");
        error.code = payload?.error?.code || "unknown";
        throw error;
    }

    return payload;
}

export function collection(...segments) {
    if (segments.length === 0) {
        throw new Error("collection() requires at least one segment");
    }

    if (typeof segments[0] === "object" && segments[0] !== null && "provider" in segments[0]) {
        return buildRef("collection", segments.slice(1));
    }

    return buildRef("collection", segments);
}

export function doc(...segments) {
    if (segments.length === 0) {
        throw new Error("doc() requires arguments");
    }

    if (segments.length === 1 && segments[0]?.kind === "collection") {
        return buildRef("doc", [...segments[0].path, crypto.randomUUID()]);
    }

    if (segments[0]?.kind === "collection") {
        return buildRef("doc", [...segments[0].path, ...segments.slice(1)]);
    }

    if (typeof segments[0] === "object" && segments[0] !== null && "provider" in segments[0]) {
        return buildRef("doc", segments.slice(1));
    }

    return buildRef("doc", segments);
}

export function where(field, op, value) {
    return { type: "where", field, op, value };
}

export function limit(value) {
    return { type: "limit", value };
}

export function query(ref, ...clauses) {
    return {
        kind: "query",
        path: ref.path,
        clauses
    };
}

export function deleteField() {
    return { __op: "__delete_field__" };
}

export function increment(value) {
    return { __op: "__increment__", value };
}

function createDocSnapshot(path, raw) {
    return {
        id: path[path.length - 1],
        ref: buildRef("doc", path),
        exists() {
            return Boolean(raw);
        },
        data() {
            return raw;
        }
    };
}

export async function getDoc(ref) {
    const path = ensurePathArray(ref);
    const payload = await callFirestore({
        op: "getDoc",
        path
    });

    return createDocSnapshot(path, payload.data ?? null);
}

export async function setDoc(ref, data) {
    await callFirestore({
        op: "setDoc",
        path: ensurePathArray(ref),
        data
    });
}

export async function updateDoc(ref, data) {
    await callFirestore({
        op: "updateDoc",
        path: ensurePathArray(ref),
        data
    });
}

export async function deleteDoc(ref) {
    await callFirestore({
        op: "deleteDoc",
        path: ensurePathArray(ref)
    });
}

export async function addDoc(ref, data) {
    const payload = await callFirestore({
        op: "addDoc",
        path: ensurePathArray(ref),
        data
    });

    return {
        id: payload.id,
        path: [...ref.path, payload.id],
        kind: "doc"
    };
}

function normalizeQueryInput(ref) {
    if (ref.kind === "query") {
        const filters = ref.clauses
            .filter((clause) => clause?.type === "where")
            .map((clause) => ({
                field: clause.field,
                op: clause.op,
                value: clause.value
            }));
        const limitClause = ref.clauses.find((clause) => clause?.type === "limit");

        return {
            path: ref.path,
            filters,
            limit: limitClause ? limitClause.value : null
        };
    }

    return {
        path: ref.path,
        filters: [],
        limit: null
    };
}

export async function getDocs(ref) {
    const input = normalizeQueryInput(ref);
    const payload = await callFirestore({
        op: "getDocs",
        path: input.path,
        filters: input.filters,
        limit: input.limit
    });

    const docs = (payload.data || []).map((entry) => ({
        id: entry.id,
        ref: buildRef("doc", [...input.path, entry.id]),
        data() {
            return entry.data;
        }
    }));

    return {
        docs,
        empty: docs.length === 0,
        forEach(callback) {
            docs.forEach(callback);
        }
    };
}
