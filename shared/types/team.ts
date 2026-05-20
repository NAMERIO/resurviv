// /api/team_v2 websocket msgs typing

import { z } from "zod";
import { type PrivateLobbyMiniGame, PrivateLobbyMiniGameIds } from "../defs/miniGame";
import type { FindGameMatchData } from "./api";

export type TeamMenuErrorType =
    | "join_full"
    | "team_full"
    | "spectator_full"
    | "join_not_found"
    | "game_in_progress"
    | "waiting_for_players"
    | "join_failed"
    | "create_failed"
    | "lost_conn"
    | "join_game_failed"
    | "find_game_error"
    | "find_game_full"
    | "find_game_invalid_protocol"
    | "find_game_invalid_captcha"
    | "kicked"
    | "banned"
    | "behind_proxy"
    | "invalid_ip"
    | "rate_limited"
    | "arena_cooldown"
    | "arena_round_finished"
    | "arena_need_teams";

export interface RoomData {
    roomUrl: string;
    findingGame: boolean;
    lastError: TeamMenuErrorType | "";
    region: string;
    autoFill: boolean;
    enabledGameModeIdxs: number[];
    gameModeIdx: number;
    maxPlayers: number;
    captchaEnabled: boolean;
    arena: boolean;
    teamsLocked: boolean;
    miniGame: PrivateLobbyMiniGame;
}

//
// Team msgs that the server sends to clients
//

/**
 * send by the server to all clients to make them join the game
 */
export interface TeamJoinGameMsg {
    readonly type: "joinGame";
    data: FindGameMatchData;
}

export interface TeamMenuPlayer {
    name: string;
    playerId: number;
    isLeader: boolean;
    inGame: boolean;
    outfit?: string;
    clanName?: string;
    clanTagColor?: string;
    team?: "A" | "B";
    spectator?: boolean;
}

/**
 * Send by the server to update the client team ui
 */
export interface TeamStateMsg {
    readonly type: "state";
    data: {
        localPlayerId: number; // always -1 by default since it can only be set when the socket is actually sending state to each individual client
        room: RoomData;
        players: TeamMenuPlayer[];
    };
}

/**
 * Send by the server when the player gets kicked from the team room
 */
export interface TeamKickedMsg {
    readonly type: "kicked";
    data: {};
}

export interface TeamErrorMsg {
    readonly type: "error";
    data: {
        type: TeamMenuErrorType;
        retryAfterSec?: number;
    };
}

export type ServerToClientTeamMsg =
    | TeamJoinGameMsg
    | TeamStateMsg
    | TeamKeepAliveMsg
    | TeamKickedMsg
    | TeamErrorMsg;

//
// Team Msgs that the client sends to the server
//

export const zClientRoomData = z.object({
    roomUrl: z.string(),
    findingGame: z.boolean(),
    lastError: z.string(),
    region: z.string(),
    autoFill: z.boolean(),
    gameModeIdx: z.number(),
    arena: z.boolean().optional(),
    teamsLocked: z.boolean().optional(),
    miniGame: z.enum(PrivateLobbyMiniGameIds).optional(),
});

export type ClientRoomData = z.infer<typeof zClientRoomData>;

export const zKeepAliveMsg = z.object({
    type: z.literal("keepAlive"),
    data: z.object({}).optional(),
});
export type TeamKeepAliveMsg = z.infer<typeof zKeepAliveMsg>;

export const zTeamJoinMsg = z.object({
    type: z.literal("join"),
    data: z.object({
        roomUrl: z.string(),
        arena: z.boolean().optional(),
        preferredTeam: z.enum(["A", "B"]).optional(),
        spectator: z.boolean().optional(),
        playerData: z.object({
            name: z.string(),
            outfit: z.string().optional(),
        }),
    }),
});
export type TeamJoinMsg = z.infer<typeof zTeamJoinMsg>;

export const zTeamChangeNameMsg = z.object({
    type: z.literal("changeName"),
    data: z.object({
        name: z.string(),
    }),
});

export type TeamChangeNameMsg = z.infer<typeof zTeamChangeNameMsg>;

export const zTeamChangeOutfitMsg = z.object({
    type: z.literal("changeOutfit"),
    data: z.object({
        outfit: z.string().optional(),
    }),
});

export type TeamChangeOutfitMsg = z.infer<typeof zTeamChangeOutfitMsg>;

export const zTeamSetRoomPropsMsg = z.object({
    type: z.literal("setRoomProps"),
    data: zClientRoomData,
});

export type TeamSetRoomPropsMsg = z.infer<typeof zTeamSetRoomPropsMsg>;

export const zTeamCreateMsg = z.object({
    type: z.literal("create"),
    data: z.object({
        arena: z.boolean().optional(),
        roomData: zClientRoomData,
        playerData: z.object({
            name: z.string(),
            outfit: z.string().optional(),
        }),
    }),
});

export type TeamCreateMsg = z.infer<typeof zTeamCreateMsg>;

export const zTeamKickMsg = z.object({
    type: z.literal("kick"),
    data: z.object({
        playerId: z.number(),
    }),
});

export type TeamKickMsg = z.infer<typeof zTeamKickMsg>;

export const zTeamSwapTeamMsg = z.object({
    type: z.literal("swapTeam"),
    data: z.object({
        playerId: z.number(),
        team: z.enum(["A", "B", "spectator"]),
    }),
});

export type TeamSwapTeamMsg = z.infer<typeof zTeamSwapTeamMsg>;

export const zTeamPlayGameMsg = z.object({
    type: z.literal("playGame"),
    data: z.object({
        version: z.number(),
        region: z.string(),
        zones: z.array(z.string()),
        turnstileToken: z.string().optional(),
    }),
});

export type TeamPlayGameMsg = z.infer<typeof zTeamPlayGameMsg>;

export const zGameCompleteMsg = z.object({
    type: z.literal("gameComplete"),
    data: z.object({}).optional(),
});

export type TeamGameCompleteMsg = z.infer<typeof zGameCompleteMsg>;

export const zTeamClientMsg = z.discriminatedUnion("type", [
    zTeamCreateMsg,
    zTeamSetRoomPropsMsg,
    zTeamJoinMsg,
    zTeamPlayGameMsg,
    zTeamKickMsg,
    zTeamSwapTeamMsg,
    zTeamChangeNameMsg,
    zTeamChangeOutfitMsg,
    zGameCompleteMsg,
    zKeepAliveMsg,
]);

export type ClientToServerTeamMsg =
    | TeamKeepAliveMsg
    | TeamJoinMsg
    | TeamChangeNameMsg
    | TeamChangeOutfitMsg
    | TeamSetRoomPropsMsg
    | TeamCreateMsg
    | TeamKickMsg
    | TeamSwapTeamMsg
    | TeamGameCompleteMsg
    | TeamPlayGameMsg;
