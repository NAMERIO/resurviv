import { and, desc, eq, gt, gte, lt, lte } from "drizzle-orm";
import { Hono } from "hono";
import { GameConfig } from "../../../../../shared/gameConfig";
import type { ArenaReplayHistoryResponse } from "../../../../../shared/types/replay";
import type { Context } from "../..";
import { db } from "../../db";
import { arenaReplayParticipantsTable, arenaReplaysTable } from "../../db/schema";
import {
    deleteReplayObject,
    loadReplayObject,
    replayStorageEnabled,
} from "../../replayStorage";

export const ArenaReplayRouter = new Hono<Context>();

ArenaReplayRouter.get("/", async (c) => {
    const user = c.get("user")!;
    const now = new Date();
    const rows = await db
        .select({
            gameId: arenaReplaysTable.gameId,
            lobbyCode: arenaReplaysTable.lobbyCode,
            region: arenaReplaysTable.region,
            mapName: arenaReplaysTable.mapName,
            miniGame: arenaReplaysTable.miniGame,
            teamMode: arenaReplaysTable.teamMode,
            durationMs: arenaReplaysTable.durationMs,
            playerCount: arenaReplaysTable.playerCount,
            spectatorCount: arenaReplaysTable.spectatorCount,
            spectator: arenaReplayParticipantsTable.spectator,
            playerName: arenaReplayParticipantsTable.playerName,
            sizeBytes: arenaReplaysTable.sizeBytes,
            compressedSizeBytes: arenaReplaysTable.compressedSizeBytes,
            createdAt: arenaReplaysTable.createdAt,
            expiresAt: arenaReplaysTable.expiresAt,
        })
        .from(arenaReplayParticipantsTable)
        .innerJoin(
            arenaReplaysTable,
            eq(arenaReplayParticipantsTable.gameId, arenaReplaysTable.gameId),
        )
        .where(
            and(
                eq(arenaReplayParticipantsTable.userId, user.id),
                gt(arenaReplaysTable.expiresAt, now),
                gte(arenaReplaysTable.replayVersion, GameConfig.replayMinVersion),
                lte(arenaReplaysTable.replayVersion, GameConfig.replayVersion),
                eq(arenaReplaysTable.protocolVersion, GameConfig.protocolVersion),
            ),
        )
        .orderBy(desc(arenaReplaysTable.createdAt))
        .limit(100);

    return c.json<ArenaReplayHistoryResponse>({
        storageEnabled: replayStorageEnabled(),
        replays: rows.map((row) => ({
            ...row,
            createdAt: row.createdAt.toISOString(),
            expiresAt: row.expiresAt.toISOString(),
        })),
    });
});

ArenaReplayRouter.get("/:gameId/file", async (c) => {
    const user = c.get("user")!;
    if (!replayStorageEnabled()) {
        return c.json({ error: "Replay storage is disabled" }, 503);
    }

    const gameId = c.req.param("gameId");
    const row = await db
        .select({ objectKey: arenaReplaysTable.objectKey })
        .from(arenaReplayParticipantsTable)
        .innerJoin(
            arenaReplaysTable,
            eq(arenaReplayParticipantsTable.gameId, arenaReplaysTable.gameId),
        )
        .where(
            and(
                eq(arenaReplayParticipantsTable.userId, user.id),
                eq(arenaReplayParticipantsTable.gameId, gameId),
                gt(arenaReplaysTable.expiresAt, new Date()),
                gte(arenaReplaysTable.replayVersion, GameConfig.replayMinVersion),
                lte(arenaReplaysTable.replayVersion, GameConfig.replayVersion),
                eq(arenaReplaysTable.protocolVersion, GameConfig.protocolVersion),
            ),
        )
        .limit(1);
    if (!row.length) return c.json({ error: "Replay not found" }, 404);

    const replay = await loadReplayObject(row[0].objectKey);
    c.header("Content-Type", "application/octet-stream");
    c.header("Cache-Control", "private, max-age=300");
    c.header("Content-Disposition", `inline; filename="${gameId}.surv"`);
    return c.body(new Uint8Array(replay));
});

export async function purgeExpiredArenaReplayMetadata() {
    if (!replayStorageEnabled()) return;

    const expired = await db
        .select({
            gameId: arenaReplaysTable.gameId,
            objectKey: arenaReplaysTable.objectKey,
        })
        .from(arenaReplaysTable)
        .where(lt(arenaReplaysTable.expiresAt, new Date()))
        .limit(500);

    for (const replay of expired) {
        try {
            await deleteReplayObject(replay.objectKey);
            await db
                .delete(arenaReplaysTable)
                .where(eq(arenaReplaysTable.gameId, replay.gameId));
        } catch (error) {
            console.error(`Failed to purge arena replay ${replay.gameId}`, error);
        }
    }
}
