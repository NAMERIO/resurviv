import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { type Context, Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { isNativeAppOrigin, nativeApp } from "../../../../../../shared/nativeApp";
import { validateSessionToken } from "../../../auth";
import { db } from "../../../db";
import {
    nativeAuthRequestsTable as requests,
    sessionTable,
    usersTable,
} from "../../../db/schema";
import { type AuthProvider, setSessionTokenCookie } from "./authUtils";

const requestSchema = z.object({
    provider: z.enum(["google", "discord"]),
    challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    link: z.boolean(),
});
const exchangeSchema = z.object({
    request: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    code: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    verifier: z.string().regex(/^[A-Za-z0-9_-]{43,128}$/),
});

export const NativeAuthRouter = new Hono();
NativeAuthRouter.use(async (c, next) => {
    c.header("Cache-Control", "no-store");
    if (
        !isNativeAppOrigin(c.req.header("Origin")) ||
        c.req.header("X-Requested-With") !== "XMLHttpRequest"
    ) {
        return c.json({ error: "invalid_origin" }, 403);
    }
    await next();
});

NativeAuthRouter.post("/request", async (c) => {
    const parsed = requestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "invalid_request" }, 400);
    const { provider, challenge, link } = parsed.data;
    let linkSessionId: string | null = null;
    if (link) {
        const token = getCookie(c, "session");
        const session = token ? (await validateSessionToken(token)).session : null;
        if (!session) return c.json({ error: "link_login_required" }, 401);
        linkSessionId = session.id;
    }
    const id = randomBytes(32).toString("base64url");
    await db.insert(requests).values({
        id,
        provider,
        challenge,
        linkSessionId,
        expiresAt: new Date(Date.now() + 600_000),
    });
    return c.json({ request: id });
});

NativeAuthRouter.post("/exchange", async (c) => {
    const parsed = exchangeSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "invalid_request" }, 400);
    const { request, code, verifier } = parsed.data;
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    // Atomic consumption prevents replay and works across API processes.
    const [completed] = await db
        .delete(requests)
        .where(
            and(
                eq(requests.id, request),
                eq(requests.challenge, challenge),
                eq(requests.codeHash, createHash("sha256").update(code).digest("hex")),
                eq(requests.completed, true),
                gt(requests.expiresAt, new Date()),
            ),
        )
        .returning();
    if (!completed || completed.error || !completed.userId) {
        return c.json({ error: "invalid_or_expired_login" }, 400);
    }
    await setSessionTokenCookie(completed.userId, c);
    return c.json({ success: true });
});

function cookieName(provider: AuthProvider) {
    return `native_oauth_${provider}`;
}
const cookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: "Lax" as const,
    path: "/api/auth",
    maxAge: 600,
};

export async function beginNativeOAuth(c: Context, provider: AuthProvider) {
    const id = c.req.query("native");
    deleteCookie(c, cookieName(provider), { path: "/api/auth" });
    if (!id) return;
    const [request] = await db
        .update(requests)
        .set({ started: true })
        .where(
            and(
                eq(requests.id, id),
                eq(requests.provider, provider),
                eq(requests.started, false),
                gt(requests.expiresAt, new Date()),
            ),
        )
        .returning();
    if (!request) throw new HTTPException(400, { message: "Login request expired" });
    setCookie(c, cookieName(provider), id, cookieOptions);
}

export async function readNativeOAuth(c: Context, provider: AuthProvider) {
    const id = getCookie(c, cookieName(provider));
    if (!id) return undefined;
    const request = await db.query.nativeAuthRequestsTable.findFirst({
        where: and(
            eq(requests.id, id),
            eq(requests.provider, provider),
            eq(requests.started, true),
            eq(requests.completed, false),
            gt(requests.expiresAt, new Date()),
        ),
    });
    if (!request) throw new HTTPException(400, { message: "Login request expired" });
    let user = null;
    if (request.linkSessionId) {
        const [linked] = await db
            .select({ user: usersTable })
            .from(sessionTable)
            .innerJoin(usersTable, eq(sessionTable.userId, usersTable.id))
            .where(
                and(
                    eq(sessionTable.id, request.linkSessionId),
                    gt(sessionTable.expiresAt, new Date()),
                ),
            );
        if (!linked)
            throw new HTTPException(401, { message: "Sign in again before linking" });
        user = linked.user;
    }
    return { request, user };
}

export async function finishNativeOAuth(
    c: Context,
    native: NonNullable<Awaited<ReturnType<typeof readNativeOAuth>>>,
    result: { user?: { id: string }; error?: string },
) {
    // Generated only after provider authentication. Knowing the initial request ID
    // and verifier is not enough: the caller must also receive the browser return.
    const code = randomBytes(32).toString("base64url");
    const [completed] = await db
        .update(requests)
        .set({
            completed: true,
            codeHash: createHash("sha256").update(code).digest("hex"),
            userId: result.user?.id ?? null,
            error: result.error ?? null,
            expiresAt: new Date(
                Math.min(native.request.expiresAt.getTime(), Date.now() + 120_000),
            ),
        })
        .where(
            and(
                eq(requests.id, native.request.id),
                eq(requests.completed, false),
                gt(requests.expiresAt, new Date()),
            ),
        )
        .returning();
    deleteCookie(c, cookieName(native.request.provider), { path: "/api/auth" });
    if (!completed) throw new HTTPException(400, { message: "Login request expired" });
    c.header("Cache-Control", "no-store");
    c.header("Referrer-Policy", "no-referrer");
    return c.redirect(
        `${nativeApp.callback}?request=${encodeURIComponent(completed.id)}&code=${code}`,
    );
}
