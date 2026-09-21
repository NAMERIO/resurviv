import type { CompetitivePlayerStats } from "../../../../shared/types/competitive";

/** Aggregate the entire accepted season, independently of the match-feed page. */
export function summarizeCompetitivePlayers(
    matches: { teams: string[][]; scores: number[] | null }[],
): Map<string, CompetitivePlayerStats> {
    const totals = new Map<string, CompetitivePlayerStats & { games: number }>();
    for (const match of matches) {
        const bestScore = match.scores ? Math.max(...match.scores) : 0;
        const tiedWinners =
            match.scores?.filter((score) => score === bestScore).length ?? 1;
        match.teams.forEach((team, index) => {
            const place = match.scores
                ? 1 + match.scores.filter((score) => score > match.scores![index]).length
                : index + 1;
            for (const userId of team) {
                const stats = totals.get(userId) ?? {
                    wins: 0,
                    draws: 0,
                    losses: 0,
                    averagePlacement: 0,
                    games: 0,
                };
                if (place === 1 && tiedWinners === 1) stats.wins++;
                else if (place === 1) stats.draws++;
                else stats.losses++;
                stats.averagePlacement += place;
                stats.games++;
                totals.set(userId, stats);
            }
        });
    }
    return new Map(
        [...totals].map(([id, stats]) => [
            id,
            {
                wins: stats.wins,
                draws: stats.draws,
                losses: stats.losses,
                averagePlacement: stats.averagePlacement / stats.games,
            },
        ]),
    );
}
