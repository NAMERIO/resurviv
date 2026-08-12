export const TournamentPlayers = [
    "Filthy",
    "Scaleznikov",
    "Razival",
    "IamOG",
    "Life",
    "Yamit",
    "Mystic",
    "Akemi",
    "Yoosepe",
    "Stxmn",
    "Goosify",
    "Meowski",
    "Jud",
    "Namerio",
    "Goldop",
    "2spas",
    "Think",
    "Hibbah",
    "Pork",
    "Maybe Mat",
    "StepZ",
    "Archaic",
    "Cash1",
    "Don Quixote",
    "Chris21",
    "Ikou",
    "xvmr",
    "Zadokbadok",
    "worldgonemad",
    "Bossk40",
    "Meowserpro",
    "Tito",
] as const;

export const TournamentPlayerRegions: Record<
    (typeof TournamentPlayers)[number],
    "NA" | "EU" | "AS"
> = {
    Filthy: "NA",
    Scaleznikov: "AS",
    Razival: "NA",
    IamOG: "NA",
    Life: "NA",
    Yamit: "NA",
    Mystic: "NA",
    Akemi: "AS",
    Yoosepe: "NA",
    Stxmn: "NA",
    Goosify: "EU",
    Meowski: "AS",
    Jud: "NA",
    Namerio: "NA",
    Goldop: "NA",
    "2spas": "NA",
    "Think": "NA",
    Hibbah: "NA",
    Pork: "NA",
    "Maybe Mat": "NA",
    StepZ: "NA",
    Archaic: "NA",
    Cash1: "NA",
    "Don Quixote": "AS",
    Chris21: "AS",
    Ikou: "NA",
    xvmr: "NA",
    Zadokbadok: "EU",
    worldgonemad: "NA",
    Bossk40: "NA",
    Meowserpro: "NA",
    Tito: "EU",
};

export interface TournamentMatchResult {
    scoreA: number | null;
    scoreB: number | null;
    winner: 0 | 1 | null;
}

export interface TournamentState {
    matches: TournamentMatchResult[];
    updatedAt: number | null;
}

export const TournamentRoundStarts = [0, 16, 24, 28, 30] as const;
export const TournamentRoundSizes = [16, 8, 4, 2, 1] as const;

export function createTournamentState(): TournamentState {
    return {
        matches: Array.from({ length: 31 }, () => ({
            scoreA: null,
            scoreB: null,
            winner: null,
        })),
        updatedAt: null,
    };
}

export function getTournamentRound(matchId: number) {
    return TournamentRoundStarts.findLastIndex((start) => matchId >= start);
}

export function getTournamentPlayers(
    state: TournamentState,
    matchId: number,
): Array<string | null> {
    const round = getTournamentRound(matchId);
    const position = matchId - TournamentRoundStarts[round];
    if (round === 0) {
        return [TournamentPlayers[position * 2], TournamentPlayers[position * 2 + 1]];
    }

    const previousStart = TournamentRoundStarts[round - 1];
    return [0, 1].map((slot) => {
        const sourceId = previousStart + position * 2 + slot;
        const sourcePlayers: Array<string | null> = getTournamentPlayers(state, sourceId);
        const winner = state.matches[sourceId]?.winner;
        return winner === 0 || winner === 1 ? sourcePlayers[winner] : null;
    });
}

export function getTournamentDescendantMatchIds(matchId: number) {
    const descendants: number[] = [];
    let round = getTournamentRound(matchId);
    let position = matchId - TournamentRoundStarts[round];
    while (round < TournamentRoundStarts.length - 1) {
        round++;
        position = Math.floor(position / 2);
        descendants.push(TournamentRoundStarts[round] + position);
    }
    return descendants;
}

export function clearTournamentDescendants(state: TournamentState, matchId: number) {
    let round = getTournamentRound(matchId);
    let position = matchId - TournamentRoundStarts[round];
    while (round < TournamentRoundStarts.length - 1) {
        round++;
        position = Math.floor(position / 2);
        state.matches[TournamentRoundStarts[round] + position] = {
            scoreA: null,
            scoreB: null,
            winner: null,
        };
    }
}
