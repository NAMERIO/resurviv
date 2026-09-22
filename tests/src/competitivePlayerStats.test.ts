import { expect, test } from "vitest";
import { summarizeCompetitivePlayers } from "../../server/src/api/competitive/playerStats";
import { competitivePlaces, zCompetitiveResult } from "../../shared/types/competitive";

test("a tiebreak winner resolves the tied result without changing the scores", () => {
    const match = {
        teams: [["namerio"], ["clover"], ["third"]],
        scores: [5, 5, 2],
        winnerTeam: 1,
    };
    expect(zCompetitiveResult.parse(match)).toEqual(match);
    expect(competitivePlaces(match)).toEqual([2, 1, 3]);
    const stats = summarizeCompetitivePlayers([match]);
    expect(stats.get("clover")).toMatchObject({ wins: 1, draws: 0, losses: 0 });
    expect(stats.get("namerio")).toMatchObject({ wins: 0, draws: 0, losses: 1 });
    expect(match.scores).toEqual([5, 5, 2]);
    expect(competitivePlaces({ ...match, winnerTeam: null })).toEqual([1, 1, 3]);
    for (const winnerTeam of [-2, 3, 0.5])
        expect(zCompetitiveResult.safeParse({ ...match, winnerTeam }).success).toBe(
            false,
        );
    expect(zCompetitiveResult.safeParse({ ...match, scores: undefined }).success).toBe(
        false,
    );
});

test("a lower-scoring team can win, and unequal scores can be recorded as a draw", () => {
    const match = { teams: [["a"], ["b"], ["c"]], scores: [10, 3, 7], winnerTeam: 1 };
    expect(zCompetitiveResult.parse(match)).toEqual(match);
    expect(competitivePlaces(match)).toEqual([2, 1, 3]);
    expect(summarizeCompetitivePlayers([match]).get("b")).toMatchObject({
        wins: 1,
        draws: 0,
        losses: 0,
    });
    const draw = { ...match, winnerTeam: -1 };
    expect(zCompetitiveResult.parse(draw)).toEqual(draw);
    expect(competitivePlaces(draw)).toEqual([1, 1, 1]);
    expect(
        [...summarizeCompetitivePlayers([draw]).values()].every(
            (stats) => stats.draws === 1 && stats.wins === 0 && stats.losses === 0,
        ),
    ).toBe(true);
    expect(competitivePlaces({ ...match, winnerTeam: null })).toEqual([1, 3, 2]);
});

test("season stats combine score wins, draws, losses and team placements", () => {
    const stats = summarizeCompetitivePlayers([
        { teams: [["a"], ["b"]], scores: [10, 7] },
        { teams: [["b"], ["a"]], scores: [5, 5] },
        { teams: [["c"], ["b"], ["a"]], scores: null },
        {
            teams: [
                ["a", "b"],
                ["c", "d"],
            ],
            scores: [2, 10],
        },
    ]);
    expect(stats.get("a")).toEqual({
        wins: 1,
        draws: 1,
        losses: 2,
        averagePlacement: 1.75,
    });
    expect(stats.get("b")).toEqual({
        wins: 0,
        draws: 1,
        losses: 3,
        averagePlacement: 1.75,
    });
    expect(stats.get("c")).toEqual({ wins: 2, draws: 0, losses: 0, averagePlacement: 1 });
});

test("empty season has no invented player stats", () => {
    expect(summarizeCompetitivePlayers([]).size).toBe(0);
});

test("equal highest scores are draws and lower tied scores are losses", () => {
    const stats = summarizeCompetitivePlayers([
        { teams: [["a"], ["b"], ["c"], ["d"]], scores: [8, 8, 2, 2] },
    ]);
    expect(stats.get("a")).toEqual({ wins: 0, draws: 1, losses: 0, averagePlacement: 1 });
    expect(stats.get("d")).toEqual({ wins: 0, draws: 0, losses: 1, averagePlacement: 3 });
});
