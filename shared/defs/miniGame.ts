export const PrivateLobbyMiniGameIds = ["pvp", "hide_and_seek"] as const;

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
        name: "Hide and Seek",
        teamNames: {
            A: "Hiders",
            B: "Seekers",
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
