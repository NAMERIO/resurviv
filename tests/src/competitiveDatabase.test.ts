import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

// Opt-in: use ONLY a disposable PostgreSQL database. Does not read game config.
const connectionString = process.env.WHR_TEST_DATABASE_URL;
let pool: any;
let testDb: any;
vi.mock("../../server/src/api/db", () => ({
    get db() {
        return testDb;
    },
}));

describe.skipIf(!connectionString)("competitive PostgreSQL transactions", () => {
    let service: typeof import("../../server/src/api/competitive/service");
    let sequence = 123456789012345670n;
    const input = (reference: string, teams = [["alice"], ["bob"]]) => ({
        teams,
        scores: [10, 7],
        playedOn: "2026-08-01",
        reference,
        requestId: String(sequence++),
        executorId: "123456789012345679",
        note: "Referee test",
    });

    beforeAll(async () => {
        const require = createRequire(
            new URL("../../server/package.json", import.meta.url),
        );
        const { Pool } = require("pg");
        const { drizzle } = require("drizzle-orm/node-postgres");
        pool = new Pool({ connectionString });
        // Unique schema confines setup and cleanup to this test run.
        const schema = `whr_test_${Date.now()}`;
        await pool.query(`CREATE SCHEMA ${schema}`);
        await pool.end();
        pool = new Pool({ connectionString, options: `-c search_path=${schema}` });
        testDb = drizzle(pool);
        await pool.query(
            "CREATE TABLE users (id text PRIMARY KEY, slug text UNIQUE NOT NULL, username text NOT NULL DEFAULT '', banned boolean NOT NULL DEFAULT false, loadout json NOT NULL DEFAULT '{}')",
        );
        await pool.query(
            readFileSync(
                new URL(
                    "../../server/src/api/db/drizzle/0040_competitive_whr.sql",
                    import.meta.url,
                ),
                "utf8",
            ),
        );
        await pool.query(
            readFileSync(
                new URL(
                    "../../server/src/api/db/drizzle/0041_competitive_winner.sql",
                    import.meta.url,
                ),
                "utf8",
            ),
        );
        await pool.query(
            "INSERT INTO users (id,slug) VALUES ('a','alice'),('b','bob'),('c','carol')",
        );
        service = await import("../../server/src/api/competitive/service");
    });
    afterAll(async () => {
        if (pool) {
            const { rows } = await pool.query("SELECT current_schema() AS name");
            if (/^whr_test_\d+$/.test(rows[0].name))
                await pool.query(`DROP SCHEMA ${rows[0].name} CASCADE`);
            await pool.end();
        }
    });

    test("simultaneous first reads create exactly one initial season", async () => {
        // Simulate tables created from schema without the migration's seed row.
        await pool.query("DELETE FROM competitive_seasons");
        const [board, list, otherBoard] = await Promise.all([
            service.getCompetitiveBoard(),
            service.getCompetitiveSeasons(),
            service.getCompetitiveBoard(),
        ]);
        expect(list).toEqual([board.season]);
        expect(otherBoard.season).toEqual(board.season);
        expect(board.season.name).toBe("Season 1");
        expect(board.players).toEqual([]);
        expect(board.matches).toEqual([]);
        expect(
            (await pool.query("SELECT count(*)::int AS count FROM competitive_seasons"))
                .rows[0].count,
        ).toBe(1);
    });
    test("explicitly creating the first season does not create a second default season", async () => {
        await pool.query("DELETE FROM competitive_seasons");
        const season = await service.startCompetitiveSeason("Opening Season");
        expect(await service.getCompetitiveSeasons()).toEqual([season]);
        expect((await service.getCompetitiveBoard()).season).toEqual(season);
    });
    test("requesting an unknown season still returns 404 without creating it", async () => {
        const before = await service.getCompetitiveSeasons();
        await expect(service.getCompetitiveBoard(2147483647)).rejects.toMatchObject({
            status: 404,
        });
        expect(await service.getCompetitiveSeasons()).toEqual(before);
    });
    test("unknown accounts cannot leave partial matches", async () => {
        await expect(
            service.addCompetitiveMatch(input("invalid", [["alice"], ["missing"]])),
        ).rejects.toThrow("does not exist");
        expect((await service.getCompetitiveBoard()).matches).toHaveLength(0);
    });
    test("team forms validate exact account slugs and reject banned accounts without writes", async () => {
        expect(
            (await service.validateCompetitivePlayers(["alice", "bob"]))
                .map((user) => user.slug)
                .sort(),
        ).toEqual(["alice", "bob"]);
        await expect(service.validateCompetitivePlayers(["Alice"])).rejects.toThrow(
            '"Alice" does not exist',
        );
        await pool.query("UPDATE users SET banned=true WHERE slug='bob'");
        try {
            await expect(service.validateCompetitivePlayers(["bob"])).rejects.toThrow(
                "is banned",
            );
            await expect(service.addCompetitiveMatch(input("banned"))).rejects.toThrow(
                "is banned",
            );
        } finally {
            await pool.query("UPDATE users SET banned=false WHERE slug='bob'");
        }
        expect((await service.getCompetitiveBoard()).matches).toHaveLength(0);
    });
    test("a calculation failure rolls back the inserted match", async () => {
        const whr = await import("../../server/src/api/competitive/whr");
        const fail = vi
            .spyOn(whr, "calculateWHR")
            .mockRejectedValueOnce(new Error("Solver unavailable"));
        try {
            await expect(service.addCompetitiveMatch(input("failed"))).rejects.toThrow(
                "Solver unavailable",
            );
            expect((await service.getCompetitiveBoard()).matches).toHaveLength(0);
        } finally {
            fail.mockRestore();
        }
    });
    test("concurrent submissions cannot duplicate a reference", async () => {
        const outcomes = await Promise.allSettled([
            service.addCompetitiveMatch(input("same")),
            service.addCompetitiveMatch(input("same")),
        ]);
        expect(outcomes.filter((r) => r.status === "fulfilled")).toHaveLength(1);
        expect(outcomes.filter((r) => r.status === "rejected")).toHaveLength(1);
        expect((await service.getCompetitiveBoard()).matches).toHaveLength(1);
    });
    test("Discord retries are idempotent and concurrent unique results are preserved", async () => {
        const match = input("retry");
        const first = await service.addCompetitiveMatch(match);
        expect(await service.addCompetitiveMatch(match)).toEqual({
            ...first,
            duplicate: true,
        });
        await Promise.all([
            service.addCompetitiveMatch(input("third")),
            service.addCompetitiveMatch(input("fourth")),
        ]);
        const board = await service.getCompetitiveBoard();
        expect(board.matches).toHaveLength(4);
        expect(board.players.map((p) => p.games)).toEqual([4, 4]);
        expect(board.players.map((p) => p.rank)).toEqual([1, 2]);
        expect(board.players[0].stats).toEqual({
            wins: 4,
            draws: 0,
            losses: 0,
            averagePlacement: 1,
        });
        expect(board.players[1].stats).toEqual({
            wins: 0,
            draws: 0,
            losses: 4,
            averagePlacement: 2,
        });
        expect((await service.getCompetitiveBoard(undefined, 25)).players).toEqual(
            board.players,
        );
    });
    test("voiding rebuilds ratings, preserves audit, and permits a corrected reference", async () => {
        const board = await service.getCompetitiveBoard();
        const match = board.matches.find((m) => m.reference === "same")!;
        await service.voidCompetitiveMatch({
            matchId: match.id,
            reason: "Wrong score",
            executorId: "123456789012345679",
        });
        const updated = await service.getCompetitiveBoard();
        expect(updated.matches.find((m) => m.id === match.id)?.voidReason).toBe(
            "Wrong score",
        );
        expect(updated.players.every((p) => p.games === 3)).toBe(true);
        expect(updated.players[0].stats.wins).toBe(3);
        const corrected = await service.addCompetitiveMatch(input("same"));
        expect(corrected.id).not.toBe(match.id);
    });
    test("account rename retains ratings and bans hide the account", async () => {
        await pool.query("UPDATE users SET slug='alice-renamed' WHERE id='a'");
        expect(
            (await service.getCompetitiveBoard()).players.some(
                (p) => p.slug === "alice-renamed" && p.games === 4,
            ),
        ).toBe(true);
        await pool.query("UPDATE users SET banned=true WHERE id='a'");
        expect((await service.getCompetitiveBoard()).players.map((p) => p.slug)).toEqual([
            "bob",
        ]);
        await expect(
            service.addCompetitiveMatch(input("banned", [["alice-renamed"], ["bob"]])),
        ).rejects.toThrow("is banned");
    });
    test("new seasons are empty and preserve the previous season", async () => {
        const previous = await service.getCompetitiveBoard();
        const next = await service.startCompetitiveSeason("Season 2");
        expect((await service.getCompetitiveBoard()).season.id).toBe(next.id);
        expect((await service.getCompetitiveBoard()).players).toEqual([]);
        expect((await service.getCompetitiveBoard(previous.season.id)).matches).toEqual(
            previous.matches,
        );
    });
    test("website corrections replace results atomically and retry without duplicating games", async () => {
        const season = (await service.getCompetitiveBoard()).season;
        const original = await service.addCompetitiveMatch(
            input("web-original", [["bob"], ["carol"]]),
        );
        const correction = {
            ...input("unused", [["bob"], ["carol"]]),
            scores: [3, 10],
            executorId: "web:developer",
        };
        const options = { seasonId: season.id, replacesMatchId: original.id };
        const saved = await service.addCompetitiveMatch(correction, options);
        expect(saved.reference).toBe("web-original");
        expect(await service.addCompetitiveMatch(correction, options)).toEqual({
            ...saved,
            duplicate: true,
        });
        const board = await service.getCompetitiveBoard();
        expect(board.matches.filter((match) => !match.voidReason)).toHaveLength(1);
        expect(board.players.every((player) => player.games === 1)).toBe(true);
        expect(board.players.find((player) => player.slug === "carol")?.stats.wins).toBe(
            1,
        );
        expect(
            (
                await pool.query(
                    "SELECT voided_by FROM competitive_matches WHERE id=$1",
                    [original.id],
                )
            ).rows[0].voided_by,
        ).toBe("web:developer");
        expect(
            (
                await pool.query(
                    "SELECT submitted_by FROM competitive_matches WHERE id=$1",
                    [saved.id],
                )
            ).rows[0].submitted_by,
        ).toBe("web:developer");
    });
    test("invalid corrections and failed calculations leave the original result intact", async () => {
        const original = await service.addCompetitiveMatch(
            input("web-rollback", [["bob"], ["carol"]]),
        );
        const before = await service.getCompetitiveBoard();
        const options = { seasonId: before.season.id, replacesMatchId: original.id };
        await expect(
            service.addCompetitiveMatch(input("bad", [["missing"], ["carol"]]), options),
        ).rejects.toThrow("does not exist");
        expect(await service.getCompetitiveBoard()).toEqual(before);
        const whr = await import("../../server/src/api/competitive/whr");
        const fail = vi
            .spyOn(whr, "calculateWHR")
            .mockRejectedValueOnce(new Error("Solver unavailable"));
        try {
            await expect(
                service.addCompetitiveMatch(
                    input("bad-solver", [["bob"], ["carol"]]),
                    options,
                ),
            ).rejects.toThrow("Solver unavailable");
        } finally {
            fail.mockRestore();
        }
        expect(await service.getCompetitiveBoard()).toEqual(before);
    });
    test("two developers cannot silently overwrite the same result", async () => {
        const original = await service.addCompetitiveMatch(
            input("web-concurrent", [["bob"], ["carol"]]),
        );
        const seasonId = (await service.getCompetitiveBoard()).season.id;
        const outcomes = await Promise.allSettled([
            service.addCompetitiveMatch(input("edit-one", [["bob"], ["carol"]]), {
                seasonId,
                replacesMatchId: original.id,
            }),
            service.addCompetitiveMatch(input("edit-two", [["bob"], ["carol"]]), {
                seasonId,
                replacesMatchId: original.id,
            }),
        ]);
        expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(
            1,
        );
        expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(
            1,
        );
        const history = (await service.getCompetitiveBoard()).matches.filter(
            (match) => match.reference === "web-concurrent",
        );
        expect(history).toHaveLength(2);
        expect(history.filter((match) => !match.voidReason)).toHaveLength(1);
    });
    test("account suggestions match names or slugs, exclude bans, and escape wildcard text", async () => {
        await pool.query(
            "INSERT INTO users (id,slug,username,banned) VALUES ('search1','lookup-target','LOUD Name',false),('search2','lookup-banned','LOUD banned',true),('search3','literal_%','Wildcard',false),('search4','literalZZ','Other',false)",
        );
        expect(await service.searchCompetitivePlayers("LOOKUP")).toEqual([
            { slug: "lookup-target", username: "LOUD Name" },
        ]);
        expect(await service.searchCompetitivePlayers("loud")).toEqual([
            { slug: "lookup-target", username: "LOUD Name" },
        ]);
        expect(
            (await service.searchCompetitivePlayers("literal_")).map((p) => p.slug),
        ).toEqual(["literal_%"]);
        expect(await service.searchCompetitivePlayers("literal_%extra")).toEqual([]);
        await pool.query(
            "INSERT INTO users(id,slug) SELECT 'suggest' || n, 'suggest-' || n FROM generate_series(1,12) n",
        );
        expect(await service.searchCompetitivePlayers("suggest")).toHaveLength(8);
        expect((await service.searchCompetitivePlayers("suggest-1"))[0].slug).toBe(
            "suggest-1",
        );
    });
    test("website new results cannot silently enter a different season", async () => {
        const season = (await service.getCompetitiveBoard()).season;
        await service.startCompetitiveSeason("Next season");
        await expect(
            service.addCompetitiveMatch(input("wrong-season", [["bob"], ["carol"]]), {
                seasonId: season.id,
            }),
        ).rejects.toThrow("current season");
        expect((await service.getCompetitiveBoard()).matches).toHaveLength(0);
    });
    test("independent winner choices persist through corrections, retries and voids without changing score-based ratings", async () => {
        const draw = await service.addCompetitiveMatch({
            ...input("tiebreak", [["bob"], ["carol"]]),
            scores: [10, 5],
        });
        const before = await service.getCompetitiveBoard();
        expect(before.matches[0].winnerTeam).toBeNull();
        const correction = {
            ...input("correction", [["bob"], ["carol"]]),
            scores: [10, 5],
            winnerTeam: 1,
        };
        const options = { seasonId: before.season.id, replacesMatchId: draw.id };
        const winner = await service.addCompetitiveMatch(correction, options);
        expect(await service.addCompetitiveMatch(correction, options)).toMatchObject({
            id: winner.id,
            duplicate: true,
        });
        const after = await service.getCompetitiveBoard();
        expect(after.matches.find((match) => match.id === winner.id)).toMatchObject({
            scores: [10, 5],
            winnerTeam: 1,
            voidReason: null,
        });
        expect(
            after.players.find((player) => player.slug === "carol")!.stats,
        ).toMatchObject({ wins: 1, losses: 0, draws: 0 });
        expect(
            after.players.find((player) => player.slug === "bob")!.stats,
        ).toMatchObject({ wins: 0, losses: 1, draws: 0 });
        expect(after.players.map((player) => player.rating)).toEqual(
            before.players.map((player) => player.rating),
        );
        const restored = await service.addCompetitiveMatch(
            {
                ...input("restore-draw", [["bob"], ["carol"]]),
                scores: [10, 5],
                winnerTeam: -1,
            },
            { seasonId: before.season.id, replacesMatchId: winner.id },
        );
        const restoredBoard = await service.getCompetitiveBoard();
        expect(
            restoredBoard.players.every(
                (player) =>
                    player.stats.draws === 1 &&
                    player.stats.wins === 0 &&
                    player.stats.losses === 0,
            ),
        ).toBe(true);
        await service.voidCompetitiveMatch({
            matchId: restored.id,
            executorId: correction.executorId,
            reason: "Test cleanup",
        });
        expect((await service.getCompetitiveBoard()).players).toEqual([]);
    });
});
