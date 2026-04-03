import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../api/db";
import {
    clanMembersTable,
    clansTable,
    userQuestTable,
    usersTable,
} from "../api/db/schema";
import { Config } from "../config";
import type { FindGamePrivateBody } from "./types";

export async function getFindGamePlayerData(
    players: Pick<
        FindGamePrivateBody["playerData"][number],
        "token" | "userId" | "ip" | "roomId" | "spectator"
    >[],
): Promise<FindGamePrivateBody["playerData"]> {
    const userIds = [
        ...new Set(players.map((p) => p.userId).filter((id) => id !== null)),
    ];

    const accountData =
        userIds.length > 0
            ? Object.fromEntries(
                  (
                      await db
                          .select({
                              userId: usersTable.id,
                              slug: usersTable.slug,
                              clanName: clansTable.name,
                              clanTagColor: clansTable.tagColor,
                              loadout: usersTable.loadout,
                              quests: sql<
                                  string[]
                              >`array_agg(${userQuestTable.questType}) filter (where ${userQuestTable.questType} is not null)`,
                          })
                          .from(usersTable)
                          .leftJoin(
                              userQuestTable,
                              and(eq(userQuestTable.userId, usersTable.id)),
                          )
                          .leftJoin(
                              clanMembersTable,
                              eq(clanMembersTable.userId, usersTable.id),
                          )
                          .leftJoin(
                              clansTable,
                              eq(clansTable.id, clanMembersTable.clanId),
                          )
                          .where(inArray(usersTable.id, userIds))
                          .groupBy(usersTable.id, clansTable.name, clansTable.tagColor)
                  ).map((r) => [r.userId, r]),
              )
            : {};

    return players.map(({ token, userId, ip, roomId, spectator }) => ({
        roomId,
        spectator,
        token,
        userId,
        ip,
        clanName: userId ? (accountData[userId]?.clanName ?? null) : null,
        clanTagColor: userId ? (accountData[userId]?.clanTagColor ?? null) : null,
        canUseDeveloper: userId
            ? !!accountData[userId]?.slug &&
              Config.debug.developerSlugs.includes(accountData[userId].slug)
            : false,
        loadout: userId ? accountData[userId]?.loadout : undefined,
        quests: userId ? (accountData[userId]?.quests ?? []) : [],
    }));
}
