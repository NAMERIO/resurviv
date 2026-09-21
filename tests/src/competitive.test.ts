import { describe, expect, test } from "vitest";
import { calculateWHR } from "../../server/src/api/competitive/whr";
import {
    type CompetitiveGame,
    parseCompetitiveResult,
    zAddCompetitiveMatch,
} from "../../shared/types/competitive";

const duel = (scores = [10, 7], playedOn = "2026-08-01"): CompetitiveGame => ({
    teams: [["alice"], ["bob"]],
    scores,
    playedOn,
});

describe("competitive result validation", () => {
    test("parses duels, teams and ranked FFA", () => {
        expect(parseCompetitiveResult("alice, bob", "10,7")).toEqual({
            teams: [["alice"], ["bob"]],
            scores: [10, 7],
        });
        expect(parseCompetitiveResult("alice+bob, carol+dave", "5,5").teams).toEqual([
            ["alice", "bob"],
            ["carol", "dave"],
        ]);
        expect(parseCompetitiveResult("alice,bob,carol").scores).toBeUndefined();
    });
    test.each([
        ["alice,alice", "10,7"],
        ["alice+bob,bob+carol", "10,7"],
        ["alice", "10"],
        ["alice,bob", "0,0"],
        ["alice,bob", "10"],
        ["alice,bob", "-1,2"],
        ["alice,bob", "1.5,2"],
        ["alice,bob", ",2"],
        ["alice,bob", "NaN,2"],
        ["alice+bob,carol", "1,2"],
        ["alice,", "1,2"],
    ])("rejects invalid result %s / %s", (players, scores) => {
        expect(() => parseCompetitiveResult(players, scores)).toThrow();
    });
    test("validates public API payload as strictly as bot input", () => {
        const input = {
            ...duel(),
            reference: "ROOM-4",
            requestId: "123456789012345678",
            executorId: "123456789012345679",
            note: "",
        };
        expect(zAddCompetitiveMatch.parse(input).reference).toBe("room-4");
        expect(
            zAddCompetitiveMatch.safeParse({ ...input, teams: [["alice"], ["alice"]] })
                .success,
        ).toBe(false);
        expect(
            zAddCompetitiveMatch.safeParse({ ...input, playedOn: "2099-01-01" }).success,
        ).toBe(false);
        expect(
            zAddCompetitiveMatch.safeParse({ ...input, playedOn: "2026-02-30" }).success,
        ).toBe(false);
    });
});

describe("whole history rating", () => {
    test("matches the original calculator's dated-history fixture", async () => {
        // StarCubey revision cfc01ad5, 2,000 iterations, prior 2, w .0215,
        // mean 5000, scale 1000. Values generated independently from upstream JS.
        const ratings = await calculateWHR([
            { teams: [["a"], ["b"]], scores: [10, 7], playedOn: "2026-08-01" },
            { teams: [["b"], ["c"]], scores: [10, 2], playedOn: "2026-08-10" },
            { teams: [["a"], ["c"]], scores: [3, 10], playedOn: "2026-08-20" },
        ]);
        const expected: Record<string, number> = {
            a: 4830.286234630057,
            b: 5218.022699488872,
            c: 4952.401858674012,
        };
        for (const player of ratings)
            expect(player.rating).toBeCloseTo(expected[player.userId], 3);
    });
    test("converges for a repeatedly played matchup", async () => {
        const ratings = await calculateWHR(Array.from({ length: 250 }, () => duel()));
        expect(ratings.every((player) => player.games === 250)).toBe(true);
        expect(ratings[0].rating + ratings[1].rating).toBeCloseTo(10000, 2);
    });
    test("repeated teams and disconnected opponent groups remain centered", async () => {
        const games: CompetitiveGame[] = Array.from({ length: 250 }, () => ({
            teams: [
                ["a", "b"],
                ["c", "d"],
            ],
            scores: [10, 7],
            playedOn: "2026-08-01",
        }));
        games.push(...Array.from({ length: 250 }, () => duel([10, 2])));
        const ratings = await calculateWHR(games);
        const rating = (id: string) =>
            ratings.find((player) => player.userId === id)!.rating;
        expect(rating("a")).toBeCloseTo(rating("b"), 4);
        expect(rating("a") + rating("c")).toBeCloseTo(10000, 3);
        expect(rating("alice") + rating("bob")).toBeCloseTo(10000, 3);
    });
    test("empty history and draws stay centered", async () => {
        expect(await calculateWHR([])).toEqual([]);
        const ratings = await calculateWHR([duel([5, 5])]);
        for (const player of ratings) expect(player.rating).toBeCloseTo(5000, 5);
    });
    test("handles a season with changing opponents across multiple dates", async () => {
        let seed = 7;
        const random = () => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed;
        };
        const games: CompetitiveGame[] = Array.from({ length: 500 }, (_, i) => {
            const a = random() % 20;
            const b = (a + 1 + (random() % 19)) % 20;
            return {
                teams: [[`p${a}`], [`p${b}`]],
                scores: [1 + (random() % 10), random() % 10],
                playedOn: `2026-08-${String(1 + (i % 28)).padStart(2, "0")}`,
            };
        });
        const ratings = await calculateWHR(games);
        expect(ratings.every((player) => Number.isFinite(player.rating))).toBe(true);
        expect(ratings.reduce((sum, player) => sum + player.games, 0)).toBe(1000);
    });
    test("single result satisfies the independent posterior equation", async () => {
        const ratings = await calculateWHR([duel([10, 0])]);
        const a =
            (ratings.find((player) => player.userId === "alice")!.rating - 5000) / 1000;
        const b =
            (ratings.find((player) => player.userId === "bob")!.rating - 5000) / 1000;
        expect(a).toBeGreaterThan(0);
        expect(a + b).toBeCloseTo(0, 5);
        const gradient =
            2 * (1 - 2 / (1 + Math.exp(-a))) + 10 * (1 - 1 / (1 + Math.exp(b - a)));
        expect(gradient).toBeCloseTo(0, 6);
    });
    test("ranked free-for-all orders players and counts matches, not points", async () => {
        const ratings = await calculateWHR([
            { teams: [["a"], ["b"], ["c"]], playedOn: "2026-08-01" },
        ]);
        expect(ratings.map((player) => player.userId)).toEqual(["a", "b", "c"]);
        expect(ratings.every((player) => player.games === 1)).toBe(true);
    });
    test("equal teammates get equal credit", async () => {
        const ratings = await calculateWHR([
            {
                teams: [
                    ["a", "b"],
                    ["c", "d"],
                ],
                scores: [10, 3],
                playedOn: "2026-08-01",
            },
        ]);
        const get = (id: string) =>
            ratings.find((player) => player.userId === id)!.rating;
        expect(get("a")).toBeCloseTo(get("b"), 3);
        expect(get("c")).toBeCloseTo(get("d"), 3);
        expect(get("a")).toBeGreaterThan(get("c"));
    });
    test("later opponents' results revise an inactive player's rating", async () => {
        const first = duel([1, 0]);
        const before = await calculateWHR([first]);
        const later: CompetitiveGame = {
            teams: [["bob"], ["carol"]],
            scores: [10, 0],
            playedOn: "2026-08-15",
        };
        const after = await calculateWHR([first, later]);
        expect(after.find((player) => player.userId === "alice")!.rating).toBeGreaterThan(
            before.find((player) => player.userId === "alice")!.rating,
        );
    });
    test("backdated input rebuilds deterministically without mutating history", async () => {
        const history = [
            duel([10, 7]),
            duel([2, 10], "2026-08-05"),
            duel([8, 4], "2026-08-20"),
        ];
        const copy = JSON.stringify(history);
        const chronological = await calculateWHR(history);
        expect(await calculateWHR([...history].reverse())).toEqual(chronological);
        expect(JSON.stringify(history)).toBe(copy);
        expect(
            chronological.every(
                (player) => player.games === 3 && Number.isFinite(player.rating),
            ),
        ).toBe(true);
    });
    test("extreme score stays finite", async () => {
        const ratings = await calculateWHR([duel([1000, 0])]);
        expect(ratings.every((player) => Number.isFinite(player.rating))).toBe(true);
    });
});
