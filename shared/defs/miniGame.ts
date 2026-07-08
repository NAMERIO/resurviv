export const PrivateLobbyMiniGameIds = [
    "pvp",
    "battle_royale",
    "hide_and_seek",
    "infected",
    "among_us",
    "capture_the_flag",
] as const;

export type PrivateLobbyMiniGame = (typeof PrivateLobbyMiniGameIds)[number];
export const DefaultPrivateLobbyMiniGame: PrivateLobbyMiniGame = "pvp";

export const ArenaTeamIds = ["A", "B", "C", "D"] as const;
export type ArenaTeam = (typeof ArenaTeamIds)[number];
export const ArenaTeamCounts = [2, 3, 4] as const;
export type ArenaTeamCount = (typeof ArenaTeamCounts)[number];
export const DefaultArenaTeamCount: ArenaTeamCount = 2;

export const AmongUsImpostorCounts = [1, 2, 3] as const;
export type AmongUsImpostorCount = (typeof AmongUsImpostorCounts)[number];
export const DefaultAmongUsImpostorCount: AmongUsImpostorCount = 1;

export interface PrivateLobbyMiniGameDef {
    id: PrivateLobbyMiniGame;
    name: string;
    singleTeam?: boolean;
    battleRoyale?: boolean;
    teamNames: Record<ArenaTeam, string>;
}

export const PrivateLobbyMiniGameDefs = {
    pvp: {
        id: "pvp",
        name: "Deathmatch",
        teamNames: {
            A: "Team A",
            B: "Team B",
            C: "Team C",
            D: "Team D",
        },
    },
    battle_royale: {
        id: "battle_royale",
        name: "Battle Royale",
        battleRoyale: true,
        teamNames: {
            A: "Players",
            B: "",
            C: "",
            D: "",
        },
    },
    hide_and_seek: {
        id: "hide_and_seek",
        name: "PROP HUNT",
        teamNames: {
            A: "Hiders",
            B: "Seekers",
            C: "",
            D: "",
        },
    },
    infected: {
        id: "infected",
        name: "INFECTED",
        teamNames: {
            A: "Zombies",
            B: "Humans",
            C: "",
            D: "",
        },
    },
    among_us: {
        id: "among_us",
        name: "AMONG US",
        singleTeam: true,
        teamNames: {
            A: "Players",
            B: "",
            C: "",
            D: "",
        },
    },
    capture_the_flag: {
        id: "capture_the_flag",
        name: "Capture the Flag",
        teamNames: {
            A: "Red",
            B: "Blue",
            C: "",
            D: "",
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

export function normalizeArenaTeamCount(count: unknown): ArenaTeamCount {
    return ArenaTeamCounts.includes(count as ArenaTeamCount)
        ? (count as ArenaTeamCount)
        : DefaultArenaTeamCount;
}
