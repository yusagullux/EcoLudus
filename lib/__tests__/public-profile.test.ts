import { describe, it, expect, vi, beforeEach } from "vitest";
import { sql } from "@/lib/db";
import { GET } from "@/app/api/users/[id]/route";
import { getSession } from "@/lib/auth";

// Mocks
vi.mock("@/lib/auth", () => ({
  getSession: vi.fn()
}));

vi.mock("@/lib/db", () => ({
  sql: vi.fn()
}));

describe("GET /api/users/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when the requester is not authenticated", async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    const res = await GET(new Request("http://localhost/api/users/u1"), { params: Promise.resolve({ id: "u1" }) });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("auth/unauthenticated");
  });

  it("returns 400 when the id parameter is missing", async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: "u2", email: "u2@example.com" });

    const res = await GET(new Request("http://localhost/api/users/"), { params: Promise.resolve({ id: "" }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("invalid-argument");
  });

  it("returns 404 when the user does not exist", async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: "u2", email: "u2@example.com" });
    vi.mocked(sql).mockResolvedValue({ rows: [], rowCount: 0 } as any);

    const res = await GET(new Request("http://localhost/api/users/u1"), { params: Promise.resolve({ id: "u1" }) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("auth/user-not-found");
  });

  it("returns a curated public profile for an existing user", async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: "u2", email: "u2@example.com" });
    vi.mocked(sql).mockResolvedValue({
      rows: [{
        id: "u1",
        email: "u1@example.com",
        payload: {
          displayName: "Eco Hero",
          profileImage: "https://example.com/avatar.png",
          xp: 1250,
          level: 5,
          ecoPoints: 420,
          missionsCompleted: 32,
          carbonReduced: 12.5,
          currentStreak: 7,
          longestStreak: 14,
          lastLoginDate: "2026-08-21",
          completedQuests: ["recycling_1", "energy_2"],
          plants: [{ name: "Mossy Fern", rarity: "common", count: 2 }],
          eggs: [{ name: "Common Egg", rarity: "common", count: 1 }],
          animals: [{ name: "Cat", rarity: "common", count: 1 }],
          seeds: [{ name: "Mossy Fern Seed", rarity: "common", count: 1 }],
          chests: [{ name: "Wooden Chest", rarity: "common", count: 3 }],
          // Private fields that must not leak into the response
          friendRequests: [{ from: "u3" }],
          settings: { theme: "dark" },
          trustScore: 88
        }
      }],
      rowCount: 1
    } as any);

    const res = await GET(new Request("http://localhost/api/users/u1"), { params: Promise.resolve({ id: "u1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.profile).toMatchObject({
      id: "u1",
      displayName: "Eco Hero",
      profileImage: "https://example.com/avatar.png",
      xp: 1250,
      level: 5,
      ecoPoints: 420,
      missionsCompleted: 32,
      carbonReduced: 12.5,
      currentStreak: 7,
      longestStreak: 14,
      lastLoginDate: "2026-08-21",
      completedQuests: ["recycling_1", "energy_2"],
      plants: [{ name: "Mossy Fern", rarity: "common", count: 2 }],
      eggs: [{ name: "Common Egg", rarity: "common", count: 1 }],
      animals: [{ name: "Cat", rarity: "common", count: 1 }],
      seeds: [{ name: "Mossy Fern Seed", rarity: "common", count: 1 }],
      chests: [{ name: "Wooden Chest", rarity: "common", count: 3 }]
    });

    // Email and private payload fields should never be exposed.
    expect(body.profile.email).toBeUndefined();
    expect(body.profile.friendRequests).toBeUndefined();
    expect(body.profile.settings).toBeUndefined();
    expect(body.profile.trustScore).toBeUndefined();
  });

  it("returns defaults for a user with an empty payload", async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: "u2", email: "u2@example.com" });
    vi.mocked(sql).mockResolvedValue({
      rows: [{ id: "u1", email: "u1@example.com", payload: {} }],
      rowCount: 1
    } as any);

    const res = await GET(new Request("http://localhost/api/users/u1"), { params: Promise.resolve({ id: "u1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.profile).toMatchObject({
      id: "u1",
      displayName: "Anonymous",
      xp: 0,
      level: 1,
      ecoPoints: 0,
      missionsCompleted: 0,
      carbonReduced: 0,
      currentStreak: 0,
      longestStreak: 0,
      lastLoginDate: "Not tracked yet",
      completedQuests: [],
      plants: [],
      eggs: [],
      animals: [],
      seeds: [],
      chests: []
    });
  });

  it("returns 500 and logs on database error", async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: "u2", email: "u2@example.com" });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(sql).mockRejectedValue(new Error("connection failed"));

    const res = await GET(new Request("http://localhost/api/users/u1"), { params: Promise.resolve({ id: "u1" }) });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("internal-error");
    expect(consoleSpy).toHaveBeenCalledWith("Get public profile error:", expect.any(Error));

    consoleSpy.mockRestore();
  });
});
