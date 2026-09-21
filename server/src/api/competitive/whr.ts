// Adapted from StarCubey/whr-rating-calculator, revision
// cfc01ad5ac1e798b5d708d816cde769c41c7a0c3. See LICENSE-StarCubey.
// Whole History Rating: https://www.remi-coulom.fr/WHR/WHR.pdf
import { setImmediate } from "node:timers/promises";
import {
    type CompetitiveGame,
    type CompetitiveRating,
    WHR_SETTINGS,
} from "../../../../shared/types/competitive";

interface RatingDay {
    day: number;
    r: number;
    games: ModelGame[];
}
interface ModelGame {
    teams: RatingDay[][];
    scores?: number[];
}

/** Fits the full dated history; input teams without scores are ordered best to worst.
 * Equal scores represent draws. UTC days, summed team strengths, score likelihood,
 * and ordered-placement likelihood follow StarCubey's implementation.
 * No browser globals, rolling deletion, or mutations of the supplied results.
 */
export async function calculateWHR(
    games: CompetitiveGame[],
): Promise<CompetitiveRating[]> {
    const players = new Map<string, Map<number, RatingDay>>();
    const counts = new Map<string, number>();
    for (const game of [...games].sort((a, b) => a.playedOn.localeCompare(b.playedOn))) {
        const day = Date.parse(`${game.playedOn}T00:00:00Z`) / 86400000;
        const model: ModelGame = { teams: [], scores: game.scores };
        for (const team of game.teams) {
            model.teams.push(
                team.map((id) => {
                    let history = players.get(id);
                    if (!history) players.set(id, (history = new Map()));
                    let ratingDay = history.get(day);
                    if (!ratingDay)
                        history.set(day, (ratingDay = { day, r: 0, games: [] }));
                    ratingDay.games.push(model);
                    counts.set(id, (counts.get(id) ?? 0) + 1);
                    return ratingDay;
                }),
            );
        }
    }
    const histories = [...players.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([id, days]) => ({ id, days: [...days.values()] }));
    const { prior, w, mean, scale } = WHR_SETTINGS;
    const parent = new Map(histories.map(({ id }) => [id, id]));
    const root = (id: string): string => {
        let current = id;
        while (parent.get(current) !== current) current = parent.get(current)!;
        return current;
    };
    const signatures = new Map<string, string[]>();
    games.forEach((game, gameIndex) => {
        const first = root(game.teams[0][0]);
        game.teams.forEach((team, teamIndex) =>
            team.forEach((id) => {
                parent.set(root(id), first);
                const signature = signatures.get(id) ?? [];
                signature.push(`${gameIndex}:${teamIndex}`);
                signatures.set(id, signature);
            }),
        );
    });
    const components = new Map<string, typeof histories>();
    const identicalTeammates = new Map<string, typeof histories>();
    for (const history of histories) {
        const component = root(history.id);
        const members = components.get(component) ?? [];
        members.push(history);
        components.set(component, members);
        const signature = signatures.get(history.id)!.join(",");
        const teammates = identicalTeammates.get(signature) ?? [];
        teammates.push(history);
        identicalTeammates.set(signature, teammates);
    }
    let converged = histories.length === 0;
    for (let iteration = 0; iteration < 1000 && !converged; iteration++) {
        const before = histories.map(({ days }) => days.map((day) => day.r));
        for (const { days } of histories) {
            const gradient = days.map(() => 0);
            const diagonal = days.map(() => 0.001); // Original Newton damping.
            const off = days.map(() => 0);
            for (let i = 0; i < days.length; i++) {
                const current = days[i];
                if (i === 0) {
                    const probability = 1 / (1 + Math.exp(-current.r));
                    gradient[i] += prior * (1 - 2 * probability);
                    diagonal[i] += 2 * prior * probability * (1 - probability);
                }
                if (i + 1 < days.length) {
                    const precision = 1 / ((days[i + 1].day - current.day) * w * w);
                    const difference = current.r - days[i + 1].r;
                    gradient[i] -= difference * precision;
                    gradient[i + 1] += difference * precision;
                    diagonal[i] += precision;
                    diagonal[i + 1] += precision;
                    off[i] = -precision;
                }
                for (const game of current.games) {
                    const strengths = game.teams.map((team) =>
                        team.reduce((sum, node) => sum + node.r, 0),
                    );
                    const own = game.teams.findIndex((team) => team.includes(current));
                    const steps = game.scores
                        ? 1
                        : Math.min(own + 1, game.teams.length - 1);
                    for (let start = 0; start < steps; start++) {
                        const max = Math.max(...strengths.slice(start));
                        const total = strengths
                            .slice(start)
                            .reduce((sum, r) => sum + Math.exp(r - max), 0);
                        const probability = Math.exp(strengths[own] - max) / total;
                        const weight = game.scores
                            ? game.scores.reduce((sum, score) => sum + score, 0)
                            : 1;
                        const observed = game.scores
                            ? game.scores[own]
                            : Number(own === start);
                        gradient[i] += observed - weight * probability;
                        diagonal[i] += weight * probability * (1 - probability);
                    }
                }
            }
            // Solve the tridiagonal positive precision matrix, then take a Newton step.
            for (let i = 1; i < days.length; i++) {
                const factor = off[i - 1] / diagonal[i - 1];
                diagonal[i] -= factor * off[i - 1];
                gradient[i] -= factor * gradient[i - 1];
            }
            const changes = days.map(() => 0);
            for (let i = days.length - 1; i >= 0; i--) {
                changes[i] =
                    (gradient[i] - (i + 1 < days.length ? off[i] * changes[i + 1] : 0)) /
                    diagonal[i];
            }
            // Scale the entire step together so temporal coupling remains intact.
            const stepScale = Math.min(1, 2 / Math.max(...changes.map(Math.abs)));
            for (let i = 0; i < days.length; i++) {
                const change = changes[i] * stepScale;
                if (!Number.isFinite(change))
                    throw new Error("WHR calculation produced a non-finite rating.");
                days[i].r += change;
            }
        }
        // Identical teammates have identical optimal histories by symmetry.
        // Averaging removes a flat likelihood direction without changing outcomes.
        for (const teammates of identicalTeammates.values()) {
            if (teammates.length < 2) continue;
            for (let i = 0; i < teammates[0].days.length; i++) {
                const mean =
                    teammates.reduce((sum, player) => sum + player.days[i].r, 0) /
                    teammates.length;
                for (const player of teammates) player.days[i].r = mean;
            }
        }
        // A common shift within a connected component leaves all equal-sized-team
        // likelihoods and temporal differences unchanged. Optimize its prior
        // exactly, avoiding very slow drift after hundreds of repeated matches.
        for (const component of components.values()) {
            let low = -100;
            let high = 100;
            for (let i = 0; i < 45; i++) {
                const shift = (low + high) / 2;
                const sum = component.reduce(
                    (total, player) =>
                        total + 1 / (1 + Math.exp(-player.days[0].r - shift)),
                    0,
                );
                if (sum > component.length / 2) high = shift;
                else low = shift;
            }
            const shift = (low + high) / 2;
            for (const { days } of component) for (const day of days) day.r += shift;
        }
        let maxChange = 0;
        histories.forEach(({ days }, p) =>
            days.forEach((day, d) => {
                maxChange = Math.max(maxChange, Math.abs(day.r - before[p][d]));
            }),
        );
        converged = maxChange < 1e-7;
        // Yield between sweeps so reads and other API work can continue.
        if (iteration % 5 === 0) await setImmediate();
    }
    if (!converged) throw new Error("WHR did not converge; no results were saved.");
    return histories
        .map(({ id, days }) => ({
            userId: id,
            rating: mean + scale * days[days.length - 1].r,
            games: counts.get(id)!,
        }))
        .sort((a, b) => b.rating - a.rating || a.userId.localeCompare(b.userId));
}
