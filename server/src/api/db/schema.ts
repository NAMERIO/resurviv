import { relations } from "drizzle-orm";
import {
    bigint,
    boolean,
    index,
    integer,
    json,
    pgTable,
    serial,
    text,
    timestamp,
    uniqueIndex,
    uuid,
} from "drizzle-orm/pg-core";
import { TeamMode } from "../../../../shared/gameConfig";
import { GameModeStatus } from "../../../../shared/types/stats";
import { ItemStatus, type Loadout, loadout } from "../../../../shared/utils/loadout";

export const sessionTable = pgTable("session", {
    id: text("id").primaryKey(),
    userId: text("user_id")
        .notNull()
        .references(() => usersTable.id, {
            onDelete: "cascade",
            onUpdate: "cascade",
        }),
    expiresAt: timestamp("expires_at").notNull(),
});

export type SessionTableSelect = typeof sessionTable.$inferSelect;

export const usersTable = pgTable("users", {
    id: text("id").notNull().primaryKey(),
    authId: text("auth_id").notNull(),
    slug: text("slug").notNull().unique(),
    banned: boolean("banned").notNull().default(false),
    banReason: text("ban_reason").notNull().default(""),
    bannedBy: text("banned_by").notNull().default(""),
    username: text("username").notNull().default(""),
    usernameSet: boolean("username_set").notNull().default(false),
    userCreated: timestamp("user_created", { withTimezone: true }).notNull().defaultNow(),
    lastUsernameChangeTime: timestamp("last_username_change_time"),
    linked: boolean("linked").notNull().default(false),
    linkedGoogle: boolean("linked_google").notNull().default(false),
    linkedDiscord: boolean("linked_discord").notNull().default(false),
    gpBalance: integer("gp_balance").notNull().default(0),
    loadout: json("loadout")
        .notNull()
        .default(loadout.validate({} as Loadout))
        .$type<Loadout>(),
});

export type UsersTableInsert = typeof usersTable.$inferInsert;
export type UsersTableSelect = typeof usersTable.$inferSelect;

export const userFriendsTable = pgTable(
    "user_friends",
    {
        id: uuid("id").notNull().primaryKey().defaultRandom(),
        requesterUserId: text("requester_user_id")
            .notNull()
            .references(() => usersTable.id, {
                onDelete: "cascade",
                onUpdate: "cascade",
            }),
        addresseeUserId: text("addressee_user_id")
            .notNull()
            .references(() => usersTable.id, {
                onDelete: "cascade",
                onUpdate: "cascade",
            }),
        status: text("status").notNull().default("pending"),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        index("idx_user_friends_requester").on(table.requesterUserId),
        index("idx_user_friends_addressee").on(table.addresseeUserId),
        uniqueIndex("idx_user_friends_pair").on(
            table.requesterUserId,
            table.addresseeUserId,
        ),
    ],
);

export type UserFriendsTableInsert = typeof userFriendsTable.$inferInsert;
export type UserFriendsTableSelect = typeof userFriendsTable.$inferSelect;

export const gpGiftTable = pgTable(
    "gp_gift",
    {
        id: uuid("id").notNull().primaryKey().defaultRandom(),
        senderUserId: text("sender_user_id")
            .notNull()
            .references(() => usersTable.id, {
                onDelete: "cascade",
                onUpdate: "cascade",
            }),
        recipientUserId: text("recipient_user_id")
            .notNull()
            .references(() => usersTable.id, {
                onDelete: "cascade",
                onUpdate: "cascade",
            }),
        amount: integer("amount").notNull(),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        seenAt: timestamp("seen_at", { withTimezone: true }),
    },
    (table) => [
        index("idx_gp_gift_recipient_seen").on(table.recipientUserId, table.seenAt),
        index("idx_gp_gift_sender").on(table.senderUserId),
    ],
);

export type GpGiftTableInsert = typeof gpGiftTable.$inferInsert;
export type GpGiftTableSelect = typeof gpGiftTable.$inferSelect;

export const skinGiftTable = pgTable(
    "skin_gift",
    {
        id: uuid("id").notNull().primaryKey().defaultRandom(),
        senderUserId: text("sender_user_id")
            .notNull()
            .references(() => usersTable.id, {
                onDelete: "cascade",
                onUpdate: "cascade",
            }),
        recipientUserId: text("recipient_user_id")
            .notNull()
            .references(() => usersTable.id, {
                onDelete: "cascade",
                onUpdate: "cascade",
            }),
        itemTypes: json("item_types").notNull().$type<string[]>(),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        seenAt: timestamp("seen_at", { withTimezone: true }),
    },
    (table) => [
        index("idx_skin_gift_recipient_seen").on(table.recipientUserId, table.seenAt),
        index("idx_skin_gift_sender").on(table.senderUserId),
    ],
);

export type SkinGiftTableInsert = typeof skinGiftTable.$inferInsert;
export type SkinGiftTableSelect = typeof skinGiftTable.$inferSelect;

export const itemsTable = pgTable(
    "items",
    {
        id: uuid("id").notNull().primaryKey().defaultRandom(),
        userId: text("user_id")
            .notNull()
            .references(() => usersTable.id, {
                onDelete: "cascade",
                onUpdate: "cascade",
            }),
        type: text("type").notNull(),
        timeAcquired: bigint("time_acquired", { mode: "number" }).notNull(),
        source: text("source").notNull().default("unlock_new_account"),
        status: integer("status").notNull().default(ItemStatus.New),
    },
    (table) => [index("idx_items_user_type").on(table.userId, table.type)],
);

export const rewardClaimsTable = pgTable(
    "reward_claims",
    {
        id: serial("id").primaryKey(),
        rewardKey: text("reward_key").notNull(),
        userId: text("user_id")
            .notNull()
            .references(() => usersTable.id, {
                onDelete: "cascade",
                onUpdate: "cascade",
            }),
        encodedIp: text("encoded_ip").notNull(),
        grantedGp: integer("granted_gp").notNull().default(0),
        claimedAt: timestamp("claimed_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        uniqueIndex("reward_claims_reward_user_unique").on(table.rewardKey, table.userId),
        index("reward_claims_reward_ip_idx").on(table.rewardKey, table.encodedIp),
    ],
);
export const userPassTable = pgTable(
    "user_pass",
    {
        userId: text("user_id")
            .notNull()
            .references(() => usersTable.id, {
                onDelete: "cascade",
                onUpdate: "cascade",
            }),
        passType: text("pass_type").notNull().default("pass_survivr1"),
        totalXp: integer("total_xp").notNull().default(0),
        unlocks: json("unlocks").notNull().default({}).$type<Record<string, boolean>>(),
        newItems: boolean("new_items").notNull().default(false),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [uniqueIndex("user_pass_user_type").on(table.userId, table.passType)],
);

export type UserPassTableSelect = typeof userPassTable.$inferSelect;

export const userQuestTable = pgTable(
    "user_quest",
    {
        id: serial("id").primaryKey(),
        userId: text("user_id")
            .notNull()
            .references(() => usersTable.id, {
                onDelete: "cascade",
                onUpdate: "cascade",
            }),
        idx: integer("idx").notNull(),
        questType: text("quest_type").notNull(),
        progress: integer("progress").notNull().default(0),
        target: integer("target").notNull(),
        complete: boolean("complete").notNull().default(false),
        rerolled: boolean("rerolled").notNull().default(false),
        timeAcquired: bigint("time_acquired", { mode: "number" }).notNull(),
        nextRefreshAt: bigint("next_refresh_at", { mode: "number" }).notNull(),
    },
    (table) => [uniqueIndex("user_quest_user_idx").on(table.userId, table.idx)],
);

export type UserQuestTableSelect = typeof userQuestTable.$inferSelect;

export const marketListingTable = pgTable(
    "market_listing",
    {
        id: uuid("id").notNull().primaryKey().defaultRandom(),
        sellerUserId: text("seller_user_id")
            .notNull()
            .references(() => usersTable.id, {
                onDelete: "cascade",
                onUpdate: "cascade",
            }),
        buyerUserId: text("buyer_user_id").references(() => usersTable.id, {
            onDelete: "set null",
            onUpdate: "cascade",
        }),
        itemId: uuid("item_id").notNull(),
        itemType: text("item_type").notNull(),
        price: integer("price").notNull(),
        status: text("status").notNull().default("active"),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        soldAt: timestamp("sold_at", { withTimezone: true }),
        sellerNotifiedAt: timestamp("seller_notified_at", { withTimezone: true }),
        canceledAt: timestamp("canceled_at", { withTimezone: true }),
    },
    (table) => [
        index("idx_market_listing_status_created").on(table.status, table.createdAt),
        index("idx_market_listing_seller_status").on(table.sellerUserId, table.status),
        index("idx_market_listing_item_status").on(table.itemId, table.status),
    ],
);

export type MarketListingTableSelect = typeof marketListingTable.$inferSelect;

export const auctionListingTable = pgTable(
    "auction_listing",
    {
        id: uuid("id").notNull().primaryKey().defaultRandom(),
        sellerUserId: text("seller_user_id")
            .notNull()
            .references(() => usersTable.id, {
                onDelete: "cascade",
                onUpdate: "cascade",
            }),
        highestBidUserId: text("highest_bid_user_id").references(() => usersTable.id, {
            onDelete: "set null",
            onUpdate: "cascade",
        }),
        itemId: uuid("item_id").notNull(),
        itemType: text("item_type").notNull(),
        startPrice: integer("start_price").notNull(),
        highestBid: integer("highest_bid").notNull().default(0),
        status: text("status").notNull().default("active"),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        soldAt: timestamp("sold_at", { withTimezone: true }),
        canceledAt: timestamp("canceled_at", { withTimezone: true }),
    },
    (table) => [
        index("idx_auction_listing_status_created").on(table.status, table.createdAt),
        index("idx_auction_listing_seller_status").on(table.sellerUserId, table.status),
        index("idx_auction_listing_item_status").on(table.itemId, table.status),
    ],
);

export type AuctionListingTableSelect = typeof auctionListingTable.$inferSelect;

export const auctionBidTable = pgTable(
    "auction_bid",
    {
        id: uuid("id").notNull().primaryKey().defaultRandom(),
        auctionId: uuid("auction_id")
            .notNull()
            .references(() => auctionListingTable.id, {
                onDelete: "cascade",
                onUpdate: "cascade",
            }),
        bidderUserId: text("bidder_user_id")
            .notNull()
            .references(() => usersTable.id, {
                onDelete: "cascade",
                onUpdate: "cascade",
            }),
        amount: integer("amount").notNull(),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        index("idx_auction_bid_auction_created").on(table.auctionId, table.createdAt),
        index("idx_auction_bid_bidder_created").on(table.bidderUserId, table.createdAt),
    ],
);

export type AuctionBidTableSelect = typeof auctionBidTable.$inferSelect;

export const matchDataTable = pgTable(
    "match_data",
    {
        userId: text("user_id").default(""),
        userBanned: boolean("user_banned").default(false),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        region: text("region").notNull(),
        mapId: integer("map_id").notNull(),
        gameMode: text("game_mode")
            .$type<GameModeStatus>()
            .notNull()
            .default(GameModeStatus.Deathmatch),
        gameId: uuid("game_id").notNull(),
        mapSeed: bigint("map_seed", { mode: "number" }).notNull(),
        username: text("username").notNull(),
        playerId: integer("player_id").notNull(),
        teamMode: integer("team_mode").$type<TeamMode>().notNull(),
        teamCount: integer("team_count").notNull(),
        teamTotal: integer("team_total").notNull(),
        teamId: integer("team_id").notNull(),
        timeAlive: integer("time_alive").notNull(),
        rank: integer("rank").notNull(),
        died: boolean("died").notNull(),
        kills: integer("kills").notNull(),
        teamKills: integer("team_kills").notNull().default(0),
        damageDealt: integer("damage_dealt").notNull(),
        damageTaken: integer("damage_taken").notNull(),
        killerId: integer("killer_id").notNull(),
        killedIds: integer("killed_ids").array().notNull(),
    },
    (table) => [
        index("idx_match_data_user_stats").on(
            table.userId,
            table.teamMode,
            table.gameMode,
            table.rank,
            table.kills,
            table.damageDealt,
            table.timeAlive,
        ),
        index("idx_game_id").on(table.gameId),
        index("idx_user_id").on(table.userId),
        index("idx_match_data_team_query").on(
            table.teamMode,
            table.gameMode,
            table.mapId,
            table.createdAt,
            table.gameId,
            table.teamId,
            table.region,
            table.kills,
        ),
    ],
);

export type MatchDataTable = typeof matchDataTable.$inferInsert;

//
// LOGS
//
export const ipLogsTable = pgTable(
    "ip_logs",
    {
        id: serial().primaryKey(),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        region: text("region").notNull(),
        gameId: text("game_id").notNull(),
        mapId: integer("map_id").notNull(),
        username: text("username").notNull(),
        userId: text("user_id").default(""),
        encodedIp: text("encoded_ip").notNull(),
        teamMode: integer("team_mode").$type<TeamMode>().notNull().default(TeamMode.Solo),
        ip: text("ip").notNull(),
        // also store the IP that was used in api/find_game...
        // since one could exploit that to never get banned
        // by requesting it with a different IP than the in-game one
        findGameIp: text("find_game_ip").notNull(),
        findGameEncodedIp: text("find_game_encoded_ip").notNull(),
    },
    (table) => [index("name_created_at_idx").on(table.username, table.createdAt)],
);

export type IpLogsTable = typeof ipLogsTable.$inferSelect;
export type IpLogsTableInsert = typeof ipLogsTable.$inferInsert;

export const bannedIpsTable = pgTable("banned_ips", {
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresIn: timestamp("expires_in").notNull(),
    encodedIp: text("encoded_ip").notNull().primaryKey(),
    permanent: boolean("permanent").notNull().default(false),
    reason: text("reason").notNull().default(""),
    bannedBy: text("banned_by").notNull().default("admin"),
});

//
// CLANS
//
export const clansTable = pgTable("clans", {
    id: uuid("id").notNull().primaryKey().defaultRandom(),
    name: text("name").notNull().unique(),
    slug: text("slug").notNull().unique(),
    icon: text("icon").notNull(), // Emote type for clan icon
    tagColor: text("tag_color").notNull().default(""),
    ownerId: text("owner_id")
        .notNull()
        .references(() => usersTable.id, {
            onDelete: "cascade",
            onUpdate: "cascade",
        }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ClansTableInsert = typeof clansTable.$inferInsert;
export type ClansTableSelect = typeof clansTable.$inferSelect;

export const clanMembersTable = pgTable(
    "clan_members",
    {
        clanId: uuid("clan_id")
            .notNull()
            .references(() => clansTable.id, {
                onDelete: "cascade",
                onUpdate: "cascade",
            }),
        userId: text("user_id")
            .notNull()
            .references(() => usersTable.id, {
                onDelete: "cascade",
                onUpdate: "cascade",
            }),
        joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        index("idx_clan_members_clan").on(table.clanId),
        index("idx_clan_members_user").on(table.userId),
        uniqueIndex("idx_clan_members_unique").on(table.clanId, table.userId),
    ],
);

export type ClanMembersTableInsert = typeof clanMembersTable.$inferInsert;
export type ClanMembersTableSelect = typeof clanMembersTable.$inferSelect;

// Track stats earned by members while in a clan
export const clanMemberStatsTable = pgTable(
    "clan_member_stats",
    {
        clanId: uuid("clan_id")
            .notNull()
            .references(() => clansTable.id, {
                onDelete: "cascade",
                onUpdate: "cascade",
            }),
        userId: text("user_id")
            .notNull()
            .references(() => usersTable.id, {
                onDelete: "cascade",
                onUpdate: "cascade",
            }),
        gameMode: text("game_mode")
            .$type<GameModeStatus>()
            .notNull()
            .default(GameModeStatus.Deathmatch),
        season: integer("season").notNull().default(1),
        kills: integer("kills").notNull().default(0),
        wins: integer("wins").notNull().default(0),
        killCgpMilli: integer("kill_cgp_milli").notNull().default(0),
        winCgpMilli: integer("win_cgp_milli").notNull().default(0),
    },
    (table) => [
        index("idx_clan_member_stats_clan").on(table.clanId),
        index("idx_clan_member_stats_user").on(table.userId),
        index("idx_clan_member_stats_game_mode").on(table.gameMode),
        index("idx_clan_member_stats_season").on(table.season),
        uniqueIndex("idx_clan_member_stats_unique").on(
            table.clanId,
            table.userId,
            table.gameMode,
            table.season,
        ),
    ],
);

export type ClanMemberStatsTableInsert = typeof clanMemberStatsTable.$inferInsert;
export type ClanMemberStatsTableSelect = typeof clanMemberStatsTable.$inferSelect;

export const clanMatchupHistoryTable = pgTable(
    "clan_matchup_history",
    {
        id: uuid("id").notNull().primaryKey().defaultRandom(),
        clanId: uuid("clan_id")
            .notNull()
            .references(() => clansTable.id, {
                onDelete: "cascade",
                onUpdate: "cascade",
            }),
        opponentClanId: uuid("opponent_clan_id")
            .notNull()
            .references(() => clansTable.id, {
                onDelete: "cascade",
                onUpdate: "cascade",
            }),
        gameId: uuid("game_id").notNull(),
        season: integer("season").notNull().default(1),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        index("idx_clan_matchup_history_clan_opponent").on(
            table.clanId,
            table.opponentClanId,
            table.season,
        ),
        uniqueIndex("idx_clan_matchup_history_unique").on(
            table.clanId,
            table.opponentClanId,
            table.gameId,
            table.season,
        ),
    ],
);

export type ClanMatchupHistoryTableInsert =
    typeof clanMatchupHistoryTable.$inferInsert;
export type ClanMatchupHistoryTableSelect =
    typeof clanMatchupHistoryTable.$inferSelect;

export const clanWarHistoryTable = pgTable(
    "clan_war_history",
    {
        id: uuid("id").notNull().primaryKey().defaultRandom(),
        clanId: uuid("clan_id")
            .notNull()
            .references(() => clansTable.id, {
                onDelete: "cascade",
                onUpdate: "cascade",
            }),
        season: integer("season").notNull().default(1),
        opponentClanName: text("opponent_clan_name").notNull().default(""),
        result: text("result").$type<"win" | "loss" | "draw">().notNull().default("win"),
        cgpAwarded: integer("cgp_awarded").notNull(),
        addedByDiscordId: text("added_by_discord_id").notNull().default(""),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        index("idx_clan_war_history_clan_created").on(table.clanId, table.createdAt),
        index("idx_clan_war_history_season").on(table.season),
    ],
);

export type ClanWarHistoryTableInsert = typeof clanWarHistoryTable.$inferInsert;
export type ClanWarHistoryTableSelect = typeof clanWarHistoryTable.$inferSelect;

export const clanSeasonMembersTable = pgTable(
    "clan_season_members",
    {
        clanId: uuid("clan_id")
            .notNull()
            .references(() => clansTable.id, {
                onDelete: "cascade",
                onUpdate: "cascade",
            }),
        userId: text("user_id")
            .notNull()
            .references(() => usersTable.id, {
                onDelete: "cascade",
                onUpdate: "cascade",
            }),
        season: integer("season").notNull(),
        joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
        leftAt: timestamp("left_at", { withTimezone: true }),
    },
    (table) => [
        index("idx_clan_season_members_clan").on(table.clanId),
        index("idx_clan_season_members_user").on(table.userId),
        index("idx_clan_season_members_season").on(table.season),
        uniqueIndex("idx_clan_season_members_unique").on(
            table.clanId,
            table.userId,
            table.season,
        ),
    ],
);

export type ClanSeasonMembersTableInsert = typeof clanSeasonMembersTable.$inferInsert;
export type ClanSeasonMembersTableSelect = typeof clanSeasonMembersTable.$inferSelect;

// Track when users leave clans (for cooldown)
export const clanLeaveHistoryTable = pgTable(
    "clan_leave_history",
    {
        userId: text("user_id")
            .notNull()
            .references(() => usersTable.id, {
                onDelete: "cascade",
                onUpdate: "cascade",
            }),
        leftAt: timestamp("left_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [index("idx_clan_leave_history_user").on(table.userId)],
);

export const clanMessagesTable = pgTable(
    "clan_messages",
    {
        id: uuid("id").notNull().primaryKey().defaultRandom(),
        clanId: uuid("clan_id")
            .notNull()
            .references(() => clansTable.id, {
                onDelete: "cascade",
                onUpdate: "cascade",
            }),
        userId: text("user_id")
            .notNull()
            .references(() => usersTable.id, {
                onDelete: "cascade",
                onUpdate: "cascade",
            }),
        type: text("type")
            .$type<"user" | "member_join" | "member_leave">()
            .notNull()
            .default("user"),
        message: text("message").notNull(),
        replyToMessageId: uuid("reply_to_message_id"),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        editedAt: timestamp("edited_at", { withTimezone: true }),
    },
    (table) => [
        index("idx_clan_messages_clan_created").on(table.clanId, table.createdAt),
        index("idx_clan_messages_user").on(table.userId),
    ],
);

export type ClanMessagesTableInsert = typeof clanMessagesTable.$inferInsert;
export type ClanMessagesTableSelect = typeof clanMessagesTable.$inferSelect;

export const clansRelations = relations(clansTable, ({ one, many }) => ({
    owner: one(usersTable, {
        fields: [clansTable.ownerId],
        references: [usersTable.id],
    }),
    members: many(clanMembersTable),
    memberStats: many(clanMemberStatsTable),
    matchupHistory: many(clanMatchupHistoryTable),
    clanWarHistory: many(clanWarHistoryTable),
    seasonMembers: many(clanSeasonMembersTable),
    messages: many(clanMessagesTable),
}));

export const clanMembersRelations = relations(clanMembersTable, ({ one }) => ({
    clan: one(clansTable, {
        fields: [clanMembersTable.clanId],
        references: [clansTable.id],
    }),
    user: one(usersTable, {
        fields: [clanMembersTable.userId],
        references: [usersTable.id],
    }),
}));

export const clanMemberStatsRelations = relations(clanMemberStatsTable, ({ one }) => ({
    clan: one(clansTable, {
        fields: [clanMemberStatsTable.clanId],
        references: [clansTable.id],
    }),
    user: one(usersTable, {
        fields: [clanMemberStatsTable.userId],
        references: [usersTable.id],
    }),
}));

export const clanMatchupHistoryRelations = relations(
    clanMatchupHistoryTable,
    ({ one }) => ({
        clan: one(clansTable, {
            fields: [clanMatchupHistoryTable.clanId],
            references: [clansTable.id],
        }),
        opponentClan: one(clansTable, {
            fields: [clanMatchupHistoryTable.opponentClanId],
            references: [clansTable.id],
        }),
    }),
);

export const clanWarHistoryRelations = relations(clanWarHistoryTable, ({ one }) => ({
    clan: one(clansTable, {
        fields: [clanWarHistoryTable.clanId],
        references: [clansTable.id],
    }),
}));

export const clanSeasonMembersRelations = relations(
    clanSeasonMembersTable,
    ({ one }) => ({
        clan: one(clansTable, {
            fields: [clanSeasonMembersTable.clanId],
            references: [clansTable.id],
        }),
        user: one(usersTable, {
            fields: [clanSeasonMembersTable.userId],
            references: [usersTable.id],
        }),
    }),
);

export const clanLeaveHistoryRelations = relations(clanLeaveHistoryTable, ({ one }) => ({
    user: one(usersTable, {
        fields: [clanLeaveHistoryTable.userId],
        references: [usersTable.id],
    }),
}));

export const clanMessagesRelations = relations(clanMessagesTable, ({ one }) => ({
    clan: one(clansTable, {
        fields: [clanMessagesTable.clanId],
        references: [clansTable.id],
    }),
    user: one(usersTable, {
        fields: [clanMessagesTable.userId],
        references: [usersTable.id],
    }),
}));
