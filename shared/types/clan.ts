import { z } from "zod";
import { GameModeStatus } from "./stats";

// Clan constants
export const ClanConstants = {
    MaxMembers: 20,
    NameMinLen: 2,
    NameMaxLen: 16,
    MessageMaxLen: 300,
    RejoinCooldownMs: 0, // none cooldown for now
    CurrentSeason: 2,
    CgpPerKill: 0.25,
    CgpPerWin: 5,
    CgpScale: 10000,
    PlayoffClanCount: 4,
} as const;

export const ClanTagColorRegex = /^(|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}|[a-zA-Z]+)$/;

export const zCreateClanRequest = z.object({
    name: z.string().trim().min(ClanConstants.NameMinLen).max(ClanConstants.NameMaxLen),
    icon: z.string().min(1),
    tagColor: z.string().trim().regex(ClanTagColorRegex).optional().default(""),
});
export type CreateClanRequest = z.infer<typeof zCreateClanRequest>;

export const zJoinClanRequest = z.object({
    clanId: z.string().uuid(),
});
export type JoinClanRequest = z.infer<typeof zJoinClanRequest>;

export const zRequestJoinClanRequest = z.object({
    clanId: z.string().uuid(),
});
export type RequestJoinClanRequest = z.infer<typeof zRequestJoinClanRequest>;

export const zCancelClanJoinRequest = z.object({
    clanId: z.string().uuid(),
});
export type CancelClanJoinRequest = z.infer<typeof zCancelClanJoinRequest>;

export const zRespondClanJoinRequest = z.object({
    requestId: z.string().uuid(),
    action: z.enum(["accept", "decline"]),
});
export type RespondClanJoinRequest = z.infer<typeof zRespondClanJoinRequest>;

export const zLeaveClanRequest = z.object({});
export type LeaveClanRequest = z.infer<typeof zLeaveClanRequest>;

export const zKickMemberRequest = z.object({
    memberId: z.string(),
});
export type KickMemberRequest = z.infer<typeof zKickMemberRequest>;

export const zTransferOwnershipRequest = z.object({
    newOwnerId: z.string(),
});
export type TransferOwnershipRequest = z.infer<typeof zTransferOwnershipRequest>;

export const zUpdateClanRequest = z.object({
    name: z
        .string()
        .trim()
        .min(ClanConstants.NameMinLen)
        .max(ClanConstants.NameMaxLen)
        .optional(),
    icon: z.string().min(1).optional(),
    tagColor: z.string().trim().regex(ClanTagColorRegex).optional(),
    isLocked: z.boolean().optional(),
});
export type UpdateClanRequest = z.infer<typeof zUpdateClanRequest>;

export const zDeleteClanRequest = z.object({});
export type DeleteClanRequest = z.infer<typeof zDeleteClanRequest>;

export const zGetClanRequest = z.object({
    clanId: z.string().uuid(),
    season: z.number().int().min(1).max(ClanConstants.CurrentSeason).optional(),
});
export type GetClanRequest = z.infer<typeof zGetClanRequest>;

export const zClanLeaderboardRequest = z.object({
    type: z.enum(["cgp", "kills", "wins"]).default("cgp"),
    gameMode: z
        .enum([GameModeStatus.Deathmatch, GameModeStatus.BattleRoyale])
        .default(GameModeStatus.Deathmatch),
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(50),
    season: z
        .number()
        .int()
        .min(1)
        .max(ClanConstants.CurrentSeason)
        .default(ClanConstants.CurrentSeason),
});
export type ClanLeaderboardRequest = z.infer<typeof zClanLeaderboardRequest>;

export type ClanLeaderboardType = ClanLeaderboardRequest["type"];

export const zGetClanMessagesRequest = z.object({
    clanId: z.string().uuid(),
    before: z.number().int().positive().optional(),
    after: z.number().int().positive().optional(),
    limit: z.number().int().min(20).max(40).default(30),
});
export type GetClanMessagesRequest = z.infer<typeof zGetClanMessagesRequest>;

export const zSendClanMessageRequest = z.object({
    clanId: z.string().uuid(),
    message: z.string().trim().min(1).max(ClanConstants.MessageMaxLen),
    replyToId: z.string().uuid().optional(),
});
export type SendClanMessageRequest = z.infer<typeof zSendClanMessageRequest>;

export const zEditClanMessageRequest = z.object({
    clanId: z.string().uuid(),
    messageId: z.string().uuid(),
    message: z.string().trim().min(1).max(ClanConstants.MessageMaxLen),
});
export type EditClanMessageRequest = z.infer<typeof zEditClanMessageRequest>;

export const zDeleteClanMessageRequest = z.object({
    clanId: z.string().uuid(),
    messageId: z.string().uuid(),
});
export type DeleteClanMessageRequest = z.infer<typeof zDeleteClanMessageRequest>;

export const zResolveKlipyGifRequest = z.object({
    clanId: z.string().uuid(),
    url: z.string().trim().url().max(300),
});
export type ResolveKlipyGifRequest = z.infer<typeof zResolveKlipyGifRequest>;

export const zResolveLobbyKlipyGifRequest = z.object({
    url: z.string().trim().url().max(300),
});
export type ResolveLobbyKlipyGifRequest = z.infer<
    typeof zResolveLobbyKlipyGifRequest
>;

export const zSearchKlipyGifsRequest = z.object({
    clanId: z.string().uuid(),
    query: z.string().trim().max(50).optional(),
    section: z.string().trim().max(30).optional(),
    limit: z.number().int().min(8).max(32).default(24),
    adMaxWidth: z.number().int().min(50).max(1200).optional(),
    adMaxHeight: z.number().int().min(50).max(400).optional(),
});
export type SearchKlipyGifsRequest = z.infer<typeof zSearchKlipyGifsRequest>;

export const zSearchLobbyKlipyGifsRequest = z.object({
    query: z.string().trim().max(50).optional(),
    section: z.string().trim().max(30).optional(),
    limit: z.number().int().min(8).max(32).default(24),
    adMaxWidth: z.number().int().min(50).max(1200).optional(),
    adMaxHeight: z.number().int().min(50).max(400).optional(),
});
export type SearchLobbyKlipyGifsRequest = z.infer<
    typeof zSearchLobbyKlipyGifsRequest
>;

export const zListClansRequest = z.object({
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(50).default(20),
    search: z.string().optional(),
});
export type ListClansRequest = z.infer<typeof zListClansRequest>;

export type ClanMember = {
    odUserId: string;
    username: string;
    slug: string;
    playerIcon: string;
    joinedAt: number;
    isOwner: boolean;
    statsAfterJoin: {
        kills: number;
        wins: number;
    };
};

export type ClanWarResult = "win" | "loss" | "draw";

export type ClanWarHistoryEntry = {
    id: string;
    opponentClanName: string;
    result: ClanWarResult;
    cgpAwarded: number;
    createdAt: number;
};

export type ClanJoinRequest = {
    id: string;
    odUserId: string;
    username: string;
    slug: string;
    playerIcon: string;
    requestedAt: number;
};

export type ClanInfo = {
    id: string;
    name: string;
    icon: string;
    tagColor: string;
    ownerId: string;
    memberCount: number;
    maxMembers: number;
    createdAt: number;
    totalCgp: number;
    totalKills: number;
    totalWins: number;
    clanWarCgp: number;
    clanWarsPlayed: number;
    season: number;
    isCurrentSeason: boolean;
    playoffQualified: boolean;
    isLocked: boolean;
    requestPending: boolean;
};

export type ClanDetail = ClanInfo & {
    members: ClanMember[];
    clanWarHistory: ClanWarHistoryEntry[];
    joinRequests?: ClanJoinRequest[];
};

export type ClanMessage = {
    id: string;
    clanId: string;
    senderId: string;
    type: "user" | "member_join" | "member_leave";
    username: string;
    slug: string;
    playerIcon: string;
    message: string;
    createdAt: number;
    editedAt: number | null;
    replyTo: {
        id: string;
        username: string;
        message: string;
    } | null;
};

export type CreateClanResponse =
    | { success: true; clan: ClanInfo }
    | {
          success: false;
          error: "name_taken" | "invalid_name" | "already_in_clan" | "server_error";
      };

export type JoinClanResponse =
    | { success: true; clan: ClanInfo }
    | {
          success: false;
          error:
              | "clan_not_found"
              | "clan_full"
              | "clan_locked"
              | "already_in_clan"
              | "cooldown_active"
              | "server_error";
          cooldownRemaining?: number;
      };

export type RequestJoinClanResponse =
    | { success: true; requestPending: true }
    | {
          success: false;
          error:
              | "clan_not_found"
              | "clan_full"
              | "already_in_clan"
              | "already_requested"
              | "cooldown_active"
              | "server_error";
          cooldownRemaining?: number;
      };

export type CancelClanJoinRequestResponse =
    | { success: true }
    | { success: false; error: "request_not_found" | "server_error" };

export type RespondClanJoinRequestResponse =
    | { success: true }
    | {
          success: false;
          error:
              | "not_owner"
              | "request_not_found"
              | "clan_full"
              | "already_in_clan"
              | "server_error";
      };

export type LeaveClanResponse =
    | { success: true }
    | { success: false; error: "not_in_clan" | "owner_cannot_leave" | "server_error" };

export type KickMemberResponse =
    | { success: true }
    | {
          success: false;
          error: "not_owner" | "member_not_found" | "cannot_kick_self" | "server_error";
      };

export type TransferOwnershipResponse =
    | { success: true }
    | { success: false; error: "not_owner" | "member_not_found" | "server_error" };

export type UpdateClanResponse =
    | { success: true; clan: ClanDetail }
    | {
          success: false;
          error: "not_owner" | "name_taken" | "invalid_name" | "server_error";
      };

export type DeleteClanResponse =
    | { success: true }
    | { success: false; error: "not_owner" | "server_error" };

export type GetClanResponse =
    | { success: true; clan: ClanDetail }
    | { success: false; error: "clan_not_found" | "server_error" };

export type GetMyClanResponse =
    | { success: true; clan: ClanDetail | null; cooldownUntil: number | null }
    | { success: false; error: "server_error" };

export type ListClansResponse = {
    clans: ClanInfo[];
    totalCount: number;
    page: number;
    totalPages: number;
};

export type ClanLeaderboardEntry = {
    rank: number;
    clan: ClanInfo;
};

export type ClanLeaderboardResponse = {
    entries: ClanLeaderboardEntry[];
    totalCount: number;
    page: number;
    totalPages: number;
};

export type GetClanMessagesResponse =
    | { success: true; messages: ClanMessage[]; hasMore: boolean }
    | { success: false; error: "not_in_clan" | "server_error" };

export type SendClanMessageResponse =
    | { success: true; message: ClanMessage }
    | {
          success: false;
          error: "not_in_clan" | "invalid_message" | "reply_not_found" | "server_error";
      };

export type EditClanMessageResponse =
    | { success: true; message: ClanMessage }
    | {
          success: false;
          error: "not_in_clan" | "not_author" | "message_not_found" | "invalid_message";
      };

export type DeleteClanMessageResponse =
    | { success: true; messageId: string }
    | { success: false; error: "not_in_clan" | "not_author" | "message_not_found" };

export type ResolveKlipyGifResponse =
    | {
          success: true;
          gif: {
              url: string;
              sourceUrl: string;
              title: string;
              width: number | null;
              height: number | null;
          };
      }
    | { success: false; error: "not_in_clan" | "invalid_url" | "not_found" };

export type KlipyGifPickerItem =
    | {
          type: "gif";
          id: string;
          url: string;
          sourceUrl: string;
          title: string;
          width: number | null;
          height: number | null;
      }
    | {
          type: "ad";
          id: string;
          title: string;
          html: string | null;
          iframeUrl: string | null;
          imageUrl: string | null;
          clickUrl: string | null;
          width: number | null;
          height: number | null;
      };

export type KlipyGifContentPickerItem = Extract<KlipyGifPickerItem, { type: "gif" }>;

export type KlipyAdPickerItem = Extract<KlipyGifPickerItem, { type: "ad" }>;

export type SearchKlipyGifsResponse =
    | { success: true; gifs: KlipyGifPickerItem[] }
    | { success: false; error: "not_in_clan" | "not_configured" | "not_found" };
