import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ add: vi.fn(), void: vi.fn(), search: vi.fn() }));
vi.mock("../../server/src/config", () => ({
    Config: { debug: { developerSlugs: ["dev"] } },
}));
vi.mock("../../server/src/api/auth/middleware", () => ({
    databaseEnabledMiddleware: (_c: any, next: any) => next(),
    authMiddleware: (c: any, next: any) => {
        const slug = c.req.header("x-test-user");
        if (!slug) return c.json({ error: "Authentication failed" }, 401);
        c.set("user", {
            id: "account-id",
            slug,
            banned: c.req.header("x-test-banned") === "true",
        });
        return next();
    },
}));
vi.mock("../../server/src/api/competitive/service", () => ({
    addCompetitiveMatch: mocks.add,
    voidCompetitiveMatch: mocks.void,
    searchCompetitivePlayers: mocks.search,
    getCompetitiveBoard: vi.fn(),
    getCompetitiveSeasons: vi.fn(),
}));

import { competitiveRouter } from "../../server/src/api/routes/stats/competitive";

const body = {
    teams: [["alice"], ["bob"]],
    scores: [10, 7],
    playedOn: "2026-08-01",
    seasonId: 1,
    requestId: "6242f4fc-252e-4711-90f0-5c9b95056b02",
};
function post(
    path: string,
    data: unknown = body,
    user?: string,
    extra: Record<string, string> = {},
) {
    return competitiveRouter.request(path, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(user ? { "x-test-user": user } : {}),
            ...extra,
        },
        body: JSON.stringify(data),
    });
}
describe("competitive website authorization", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.add.mockResolvedValue({ id: "saved", duplicate: false });
    });
    test.each([
        "/editor/result",
        "/editor/void",
        "/editor/players",
    ])("%s rejects guests, non-developers and banned developers", async (path) => {
        expect((await post(path)).status).toBe(401);
        expect((await post(path, body, "ordinary-player")).status).toBe(403);
        expect((await post(path, body, "dev", { "x-test-banned": "true" })).status).toBe(
            403,
        );
        expect(mocks.add).not.toHaveBeenCalled();
        expect(mocks.void).not.toHaveBeenCalled();
        expect(mocks.search).not.toHaveBeenCalled();
    });
    test("developer account suggestions validate and trim search text", async () => {
        mocks.search.mockResolvedValueOnce([{ slug: "namerio", username: "NAMERIO" }]);
        const response = await post("/editor/players", { query: "  name " }, "dev");
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            players: [{ slug: "namerio", username: "NAMERIO" }],
        });
        expect(mocks.search).toHaveBeenCalledExactlyOnceWith("name");
        expect((await post("/editor/players", { query: "n" }, "dev")).status).toBe(400);
        expect(
            (await post("/editor/players", { query: "x".repeat(101) }, "dev")).status,
        ).toBe(400);
        expect(mocks.search).toHaveBeenCalledTimes(1);
    });
    test("permissions use the tournament developer allowlist", async () => {
        expect((await competitiveRouter.request("/permissions")).status).toBe(401);
        for (const [user, canEdit] of [
            ["dev", true],
            ["ordinary-player", false],
        ] as const) {
            const response = await competitiveRouter.request("/permissions", {
                headers: { "x-test-user": user },
            });
            expect(await response.json()).toEqual({ canEdit });
        }
    });
    test("saves use the authenticated actor and a namespaced retry key", async () => {
        const response = await post(
            "/editor/result",
            { ...body, executorId: "impersonated", reference: "fake" },
            "dev",
        );
        expect(response.status).toBe(200);
        expect(mocks.add).toHaveBeenCalledWith(
            {
                teams: body.teams,
                scores: body.scores,
                playedOn: body.playedOn,
                note: "",
                executorId: "web:account-id",
                requestId: `web:account-id:${body.requestId}`,
                reference: `web-${body.requestId}`,
            },
            { seasonId: 1, replacesMatchId: undefined },
        );
    });
    test("corrections pass the original match and season; voids use authenticated actors", async () => {
        const matchId = "72b52aad-256e-4b56-90c7-1bfd95ba7d2a";
        expect((await post("/editor/result", { ...body, matchId }, "dev")).status).toBe(
            200,
        );
        expect(mocks.add.mock.calls[0][1]).toEqual({
            seasonId: 1,
            replacesMatchId: matchId,
        });
        expect(
            (
                await post(
                    "/editor/void",
                    { matchId, reason: "Wrong score", executorId: "other" },
                    "dev",
                )
            ).status,
        ).toBe(200);
        expect(mocks.void).toHaveBeenCalledWith({
            matchId,
            reason: "Wrong score",
            executorId: "web:account-id",
        });
    });
    test("saves and corrections allow lower-scoring winners and explicit draws", async () => {
        for (const matchId of [undefined, "72b52aad-256e-4b56-90c7-1bfd95ba7d2a"]) {
            expect(
                (await post("/editor/result", { ...body, matchId, winnerTeam: 1 }, "dev"))
                    .status,
            ).toBe(200);
            expect(mocks.add.mock.calls.at(-1)![0]).toMatchObject({
                scores: [10, 7],
                winnerTeam: 1,
            });
        }
        expect(
            (await post("/editor/result", { ...body, winnerTeam: -1 }, "dev")).status,
        ).toBe(200);
        expect(mocks.add.mock.calls.at(-1)![0].winnerTeam).toBe(-1);
        expect(
            (await post("/editor/result", { ...body, winnerTeam: 2 }, "dev")).status,
        ).toBe(400);
        expect(mocks.add).toHaveBeenCalledTimes(3);
    });
    test("invalid rosters and simple cross-site form content cannot mutate results", async () => {
        expect(
            (
                await post(
                    "/editor/result",
                    { ...body, teams: [["alice"], ["alice"]] },
                    "dev",
                )
            ).status,
        ).toBe(400);
        expect(
            (await post("/editor/result", body, "dev", { "Content-Type": "text/plain" }))
                .status,
        ).toBe(415);
        expect(mocks.add).not.toHaveBeenCalled();
    });
});
