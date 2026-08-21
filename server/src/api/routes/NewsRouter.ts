import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import type {
    ManageNewsPost,
    ManageNewsResponse,
    NewsPost,
    NewsResponse,
} from "../../../../shared/types/news";
import { zDeleteNewsRequest, zSaveNewsRequest } from "../../../../shared/types/news";
import { Config } from "../../config";
import type { Context } from "..";
import {
    authMiddleware,
    databaseEnabledMiddleware,
    validateParams,
} from "../auth/middleware";
import { db } from "../db";
import { newsTable } from "../db/schema";

const MaxNewsPosts = 20;
const MaxManagedNewsPosts = 100;
const NewsCacheDurationMs = 60_000;
let newsCache: { expiresAt: number; data: NewsResponse } | undefined;

export function invalidateNewsCache() {
    newsCache = undefined;
}

function canManageNews(slug: string) {
    return (
        Config.debug.adminSlugs.includes(slug) || Config.debug.ownerSlugs.includes(slug)
    );
}

function toNewsPost(row: typeof newsTable.$inferSelect): NewsPost {
    return {
        id: row.id,
        title: row.title,
        content: row.content,
        document: row.document,
        dateText: row.dateText,
        publishedAt: row.publishedAt.toISOString(),
    };
}

function isSiteRequest(header: string | undefined) {
    return header === "XMLHttpRequest";
}

export const NewsRouter = new Hono<Context>()
    .get("/", databaseEnabledMiddleware, async (c) => {
        let data =
            newsCache?.expiresAt && newsCache.expiresAt > Date.now()
                ? newsCache.data
                : undefined;

        if (!data) {
            const rows = await db
                .select()
                .from(newsTable)
                .where(eq(newsTable.isPublished, true))
                .orderBy(desc(newsTable.publishedAt), desc(newsTable.id))
                .limit(MaxNewsPosts);

            data = { posts: rows.map(toNewsPost) };
            newsCache = {
                data,
                expiresAt: Date.now() + NewsCacheDurationMs,
            };
        }

        c.header("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
        return c.json<NewsResponse>(data, 200);
    })
    .get("/manage", databaseEnabledMiddleware, authMiddleware, async (c) => {
        const user = c.get("user")!;
        if (!canManageNews(user.slug)) {
            return c.json({ error: "News manager access required" }, 403);
        }

        const rows = await db
            .select()
            .from(newsTable)
            .orderBy(desc(newsTable.publishedAt), desc(newsTable.id))
            .limit(MaxManagedNewsPosts);
        const posts: ManageNewsPost[] = rows.map((row) => ({
            ...toNewsPost(row),
            isPublished: row.isPublished,
        }));

        c.header("Cache-Control", "no-store");
        return c.json<ManageNewsResponse>({ posts }, 200);
    })
    .post(
        "/save",
        databaseEnabledMiddleware,
        authMiddleware,
        validateParams(zSaveNewsRequest),
        async (c) => {
            const user = c.get("user")!;
            if (!canManageNews(user.slug)) {
                return c.json({ error: "News manager access required" }, 403);
            }
            if (!isSiteRequest(c.req.header("X-Requested-With"))) {
                return c.json({ error: "Invalid request" }, 403);
            }

            const { id, title, dateText, document, publish } = c.req.valid("json");
            const content = document.paragraphs
                .map((paragraph) => paragraph.runs.map((run) => run.text).join(""))
                .join("\n")
                .trim();
            if (!content) {
                return c.json({ error: "News text is required" }, 400);
            }

            let savedId: number;
            if (id) {
                const [post] = await db
                    .update(newsTable)
                    .set({
                        title,
                        content,
                        dateText,
                        document,
                        isPublished: publish,
                        updatedAt: new Date(),
                    })
                    .where(eq(newsTable.id, id))
                    .returning({ id: newsTable.id });
                if (!post) return c.json({ error: "News post not found" }, 404);
                savedId = post.id;
            } else {
                const [post] = await db
                    .insert(newsTable)
                    .values({
                        title,
                        content,
                        dateText,
                        document,
                        authorUserId: user.id,
                        isPublished: publish,
                    })
                    .returning({ id: newsTable.id });
                savedId = post.id;
            }

            invalidateNewsCache();
            return c.json({ success: true, id: savedId, published: publish }, 200);
        },
    )
    .post(
        "/delete",
        databaseEnabledMiddleware,
        authMiddleware,
        validateParams(zDeleteNewsRequest),
        async (c) => {
            const user = c.get("user")!;
            if (!canManageNews(user.slug)) {
                return c.json({ error: "News manager access required" }, 403);
            }
            if (!isSiteRequest(c.req.header("X-Requested-With"))) {
                return c.json({ error: "Invalid request" }, 403);
            }

            const { id } = c.req.valid("json");
            const [deleted] = await db
                .delete(newsTable)
                .where(eq(newsTable.id, id))
                .returning({ id: newsTable.id });
            if (!deleted) return c.json({ error: "News post not found" }, 404);

            invalidateNewsCache();
            return c.json({ success: true }, 200);
        },
    );
