export const PrivateLobbyMiniGameIds = [
    "pvp",
    "battle_royale",
    "hide_and_seek",
    "infected",
    "among_us",
] as const;

export type PrivateLobbyMiniGame = (typeof PrivateLobbyMiniGameIds)[number];
export const DefaultPrivateLobbyMiniGame: PrivateLobbyMiniGame = "pvp";

export const AmongUsImpostorCounts = [1, 2, 3] as const;
export type AmongUsImpostorCount = (typeof AmongUsImpostorCounts)[number];
export const DefaultAmongUsImpostorCount: AmongUsImpostorCount = 1;

export interface PrivateLobbyMiniGameDef {
    id: PrivateLobbyMiniGame;
    name: string;
    singleTeam?: boolean;
    battleRoyale?: boolean;
    teamNames: {
        A: string;
        B: string;
    };
}

export const PrivateLobbyMiniGameDefs = {
    pvp: {
        id: "pvp",
        name: "Deathmatch",
        teamNames: {
            A: "Team A",
            B: "Team B",
        },
    },
    battle_royale: {
        id: "battle_royale",
        name: "Battle Royale",
        battleRoyale: true,
        teamNames: {
            A: "Players",
            B: "",
        },
    },
    hide_and_seek: {
        id: "hide_and_seek",
        name: "PROP HUNT",
        teamNames: {
            A: "Hiders",
            B: "Seekers",
        },
    },
    infected: {
        id: "infected",
        name: "INFECTED",
        teamNames: {
            A: "Zombies",
            B: "Humans",
        },
    },
    among_us: {
        id: "among_us",
        name: "AMONG US",
        singleTeam: true,
        teamNames: {
            A: "Players",
            B: "",
        },
    },
} satisfies Record<PrivateLobbyMiniGame, PrivateLobbyMiniGameDef>;

export function getPrivateLobbyMiniGameDef(miniGame?: string): PrivateLobbyMiniGameDef {
    return PrivateLobbyMiniGameDefs[
        isPrivateLobbyMiniGame(miniGame) ? miniGame : DefaultPrivateLobbyMiniGame
    ];
}

export function isPrivateLobbyMiniGame(
    miniGame: string | undefined,
): miniGame is PrivateLobbyMiniGame {
    return (
        !!miniGame && PrivateLobbyMiniGameIds.includes(miniGame as PrivateLobbyMiniGame)
    );
}

export function normalizeAmongUsImpostorCount(count: unknown): AmongUsImpostorCount {
    return AmongUsImpostorCounts.includes(count as AmongUsImpostorCount)
        ? (count as AmongUsImpostorCount)
        : DefaultAmongUsImpostorCount;
}
