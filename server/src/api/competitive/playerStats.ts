import {
    type CompetitivePlayerStats,
    competitivePlaces,
} from "../../../../shared/types/competitive";

/** Aggregate the entire accepted season, independently of the match-feed page. */
export function summarizeCompetitivePlayers(
    matches: { teams: string[][]; scores: number[] | null; winnerTeam?: number | null }[],
): Map<string, CompetitivePlayerStats> {
    const totals = new Map<string, CompetitivePlayerStats & { games: number }>();
    for (const match of matches) {
        const places = competitivePlaces(match);
        const tiedWinners = places.filter((place) => place === 1).length;
        match.teams.forEach((team, index) => {
            const place = places[index];
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
