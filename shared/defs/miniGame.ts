export const PrivateLobbyMiniGameIds = [
    "pvp",
    "hide_and_seek",
    "infected",
    "among_us",
] as const;

export type PrivateLobbyMiniGame = (typeof PrivateLobbyMiniGameIds)[number];
export const DefaultPrivateLobbyMiniGame: PrivateLobbyMiniGame = "pvp";

export interface PrivateLobbyMiniGameDef {
    id: PrivateLobbyMiniGame;
    name: string;
    teamNames: {
        A: string;
        B: string;
    };
}

export const PrivateLobbyMiniGameDefs = {
    pvp: {
        id: "pvp",
        name: "PvP",
        teamNames: {
            A: "Team A",
            B: "Team B",
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
        teamNames: {
            A: "Crewmates",
            B: "Impostors",
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
