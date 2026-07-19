import { z } from "zod";
import type { MapDefs } from "../../../shared/defs/mapDefs";
import {
    type AmongUsImpostorCount,
    ArenaTeamIds,
    type PrivateLobbyMiniGame,
    PrivateLobbyMiniGameIds,
} from "../../../shared/defs/miniGame";
import { TeamMode } from "../../../shared/gameConfig";
import type { FindGameError } from "../../../shared/types/api";
import { loadoutSchema } from "../../../shared/utils/loadout";
import type { MatchDataTable } from "../api/db/schema";

export interface GameSocketData {
    gameId: string;
    id: string;
    closed: boolean;
    rateLimit: Record<symbol, number>;
    ip: string;
    disconnectReason: string;
}

export const zUpdateRegionBody = z.object({
    regionId: z.string(),
    data: z.object({
        playerCount: z.number(),
    }),
});
export type UpdateRegionBody = z.infer<typeof zUpdateRegionBody>;

export const zSetGameModeBody = z.object({
    index: z.number(),
    mode_type: z.enum(["deathmatch", "br"]).default("deathmatch"),
    team_mode: z.nativeEnum(TeamMode).optional(),
    map_name: z.string().optional(),
    enabled: z.boolean().optional(),
});

export const zListGameModesBody = z.object({});

export const zTopRankPlayersBody = z.object({
    interval: z.enum(["daily", "weekly", "alltime"]).default("alltime"),
});

export const zSetClientThemeBody = z.object({
    theme: z.string(),
});

export const zSetBattleRoyaleModeBody = z.object({
    enabled: z.boolean(),
});

export const zSetPauseClanStatsBody = z.object({
    enabled: z.boolean(),
});

export const zSetLockClanJoinsBody = z.object({
    locked: z.boolean(),
});

export const zSetBattlePassEndBody = z.object({
    days: z.number().int().min(0).max(3650),
});

export const zAddClanWarCgpBody = z.object({
    clan: z.string().trim().min(1),
    amount: z.number().int().nonnegative(),
    opponent: z.string().trim().max(32).optional().default("Clan War"),
    result: z.enum(["win", "loss", "draw"]).optional().default("win"),
    executor_id: z.string().default("admin"),
});

export const zSetClanCgpValueBody = z.object({
    value: z.number().min(0).max(100),
});

export const zListFeaturedYoutubersBody = z.object({});

export const zRemoveFeaturedYoutuberBody = z.object({
    name: z.string().trim().min(1),
});

export interface SaveGameBody {
    matchData: (MatchDataTable & {
        ip: string;
        findGameIp: string;
        outfit?: string;
        melee?: string;
    })[];
}

export interface ServerGameConfig {
    readonly mapName: keyof typeof MapDefs;
    readonly teamMode: TeamMode;
    readonly arenaPrivate?: boolean;
    readonly miniGame?: PrivateLobbyMiniGame;
    readonly amongUsImpostorCount?: AmongUsImpostorCount;
    readonly disableAirstrikes?: boolean;
    readonly disablePerks?: boolean;
}

export interface GameData {
    id: string;
    teamMode: TeamMode;
    mapName: string;
    arenaPrivate?: boolean;
    miniGame?: PrivateLobbyMiniGame;
    amongUsImpostorCount?: AmongUsImpostorCount;
    disableAirstrikes?: boolean;
    disablePerks?: boolean;
    canJoin: boolean;
    aliveCount: number;
    startedTime: number;
    stopped: boolean;
}

export const zFindGamePrivateBody = z.object({
    region: z.string(),
    version: z.number(),
    autoFill: z.boolean(),
    mapName: z.string(),
    teamMode: z.number(),
    arenaPrivate: z.boolean().optional(),
    miniGame: z.enum(PrivateLobbyMiniGameIds).optional(),
    amongUsImpostorCount: z.number().int().min(1).max(3).optional(),
    disableAirstrikes: z.boolean().optional(),
    disablePerks: z.boolean().optional(),
    groupHash: z.string().optional(),
    targetGameId: z.string().optional(),
    playerData: z.array(
        z.object({
            roomId: z.string().optional(),
            spectator: z.boolean().optional(),
            token: z.string(),
            userId: z.string().nullable(),
            ip: z.string(),
            clanName: z.string().nullable().optional(),
            clanTagColor: z.string().nullable().optional(),
            canUseDeveloper: z.boolean().optional(),
            loadout: loadoutSchema.optional(),
            arenaTeam: z.enum(ArenaTeamIds).optional(),
            quests: z.array(z.string()).optional(),
        }),
    ),
});

export type FindGamePrivateBody = z.infer<typeof zFindGamePrivateBody>;

export type FindGamePrivateRes =
    | {
          gameId: string;
          useHttps: boolean;
          hosts: string[];
          addrs: string[];
          forcedSpectator?: boolean;
      }
    | { error: FindGameError };

export enum ProcessMsgType {
    Create,
    Created,
    KeepAlive,
    UpdateData,
    AddJoinToken,
    SocketMsg,
    SocketClose,
    KickPlayerByIP,
}

export interface CreateGameMsg {
    type: ProcessMsgType.Create;
    config: ServerGameConfig;
    id: string;
}

export interface GameCreatedMsg {
    type: ProcessMsgType.Created;
}

export interface KeepAliveMsg {
    type: ProcessMsgType.KeepAlive;
}

export interface UpdateDataMsg extends GameData {
    type: ProcessMsgType.UpdateData;
}

export interface AddJoinTokenMsg {
    type: ProcessMsgType.AddJoinToken;
    autoFill: boolean;
    tokens: FindGamePrivateBody["playerData"];
}

export interface KickPlayerByIPMsg {
    type: ProcessMsgType.KickPlayerByIP;
    encodedIp: string;
}

/**
 * Used for server to send websocket msgs to game
 * And game to send websocket msgs to clients
 * msgs is an array to batch all msgs created in the same game net tick
 * into the same send call
 */
export interface SocketMsgsMsg {
    type: ProcessMsgType.SocketMsg;
    msgs: Array<{
        socketId: string;
        ip: string;
        data: ArrayBuffer | Uint8Array;
    }>;
}

/**
 * Sent by the server to the game when the socket is closed
 * Or by the game to the server when the game wants to close the socket
 */
export interface SocketCloseMsg {
    type: ProcessMsgType.SocketClose;
    socketId: string;
    reason?: string;
}

export type ProcessMsg =
    | CreateGameMsg
    | GameCreatedMsg
    | KeepAliveMsg
    | UpdateDataMsg
    | AddJoinTokenMsg
    | KickPlayerByIPMsg
    | SocketMsgsMsg
    | SocketCloseMsg;
