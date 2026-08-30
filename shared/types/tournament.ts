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
    Think: "NA",
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
export const TournamentFinalMatchId = 30;

export const TournamentBetLimits = {
    minimum: 250,
    maximum: 2500,
    maximumOddsHundredths: 500,
} as const;

export type TournamentBetMarketId =
    | "winner"
    | "margin"
    | "game_11"
    | "grenade_kills"
    | "heal_off";

export type TournamentBetStatus = "pending" | "won" | "lost";

export interface TournamentBetOption {
    id: string;
    label: string;
    oddsHundredths: number;
}

export interface TournamentBetMarket {
    id: TournamentBetMarketId;
    title: string;
    description: string;
    options: TournamentBetOption[];
}

export interface TournamentBet {
    market: TournamentBetMarketId;
    selection: string;
    oddsHundredths: number;
    amount: number;
    status: TournamentBetStatus;
    payout: number;
}

export function getTournamentBetMarkets(
    players: ReadonlyArray<string | null>,
): TournamentBetMarket[] {
    return [
        {
            id: "winner",
            title: "Match Winner",
            description: "Pick the player who wins the series.",
            options: [
                {
                    id: "player_a",
                    label: players[0] ?? "Player A",
                    oddsHundredths: 230,
                },
                {
                    id: "player_b",
                    label: players[1] ?? "Player B",
                    oddsHundredths: 160,
                },
            ],
        },
        {
            id: "margin",
            title: "Winning Margin",
            description: "Predict how close the series will be.",
            options: [
                {
                    id: "blowout",
                    label: "Blowout (7-0, 7-1, 7-2)",
                    oddsHundredths: 450,
                },
                {
                    id: "comfortable",
                    label: "Comfortable (7-3, 7-4)",
                    oddsHundredths: 270,
                },
                { id: "close", label: "Close (7-5, 7-6)", oddsHundredths: 220 },
            ],
        },
        {
            id: "game_11",
            title: "Will the Match Reach Game 11?",
            description:
                "Will the series reach an eleventh game, meaning the score reaches 6-4?",
            options: [
                { id: "yes", label: "Yes", oddsHundredths: 190 },
                { id: "no", label: "No", oddsHundredths: 190 },
            ],
        },
        {
            id: "grenade_kills",
            title: "Total Grenade Kills",
            description: "Will there be more or fewer than 2.5 grenade kills?",
            options: [
                { id: "over", label: "Over 2.5", oddsHundredths: 210 },
                { id: "under", label: "Under 2.5", oddsHundredths: 175 },
            ],
        },
        {
            id: "heal_off",
            title: "Final Heal-Off",
            description: "Will the final game end in a heal-off?",
            options: [
                { id: "yes", label: "Yes", oddsHundredths: 400 },
                { id: "no", label: "No", oddsHundredths: 130 },
            ],
        },
    ];
}

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
