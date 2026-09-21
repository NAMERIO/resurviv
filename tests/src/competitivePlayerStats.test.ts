import { expect, test } from "vitest";
import { summarizeCompetitivePlayers } from "../../server/src/api/competitive/playerStats";

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
