import { z } from "zod";
import { GameModeStatus } from "./stats";

// Clan constants
export const ClanConstants = {
    MaxMembers: 20,
    NameMinLen: 2,
    NameMaxLen: 16,
    MessageMaxLen: 100,
    RejoinCooldownMs: 0, // none cooldown for now
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
});
export type UpdateClanRequest = z.infer<typeof zUpdateClanRequest>;

export const zDeleteClanRequest = z.object({});
export type DeleteClanRequest = z.infer<typeof zDeleteClanRequest>;

export const zGetClanRequest = z.object({
    clanId: z.string().uuid(),
});
export type GetClanRequest = z.infer<typeof zGetClanRequest>;

export const zClanLeaderboardRequest = z.object({
    type: z.enum(["kills", "wins"]),
    gameMode: z
        .enum([GameModeStatus.Deathmatch, GameModeStatus.BattleRoyale])
        .default(GameModeStatus.Deathmatch),
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(50),
});
export type ClanLeaderboardRequest = z.infer<typeof zClanLeaderboardRequest>;

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

export type ClanInfo = {
    id: string;
    name: string;
    icon: string;
    tagColor: string;
    ownerId: string;
    memberCount: number;
    maxMembers: number;
    createdAt: number;
    totalKills: number;
    totalWins: number;
};

export type ClanDetail = ClanInfo & {
    members: ClanMember[];
};

export type ClanMessage = {
    id: string;
    clanId: string;
    senderId: string;
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
              | "already_in_clan"
              | "cooldown_active"
              | "server_error";
          cooldownRemaining?: number;
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
