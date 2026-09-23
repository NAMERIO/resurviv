import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { nativeApp } from "../../shared/nativeApp";

const mocks = vi.hoisted(() => ({
    insert: vi.fn(),
    consume: vi.fn(),
    complete: vi.fn(),
    validateSession: vi.fn(),
    setSession: vi.fn(),
}));
vi.mock("../../server/src/api/db", () => ({
    db: {
        insert: () => ({ values: mocks.insert }),
        update: () => ({
            set: (values: unknown) => ({
                where: () => ({ returning: () => mocks.complete(values) }),
            }),
        }),
        delete: () => ({
            where: (condition: unknown) => ({
                returning: () => mocks.consume(condition),
            }),
        }),
    },
}));
vi.mock("../../server/src/api/auth", () => ({
    validateSessionToken: mocks.validateSession,
}));
vi.mock("../../server/src/api/routes/user/auth/authUtils", () => ({
    setSessionTokenCookie: mocks.setSession,
}));

import {
    finishNativeOAuth,
    NativeAuthRouter,
} from "../../server/src/api/routes/user/auth/native";

const { PgDialect } = createRequire(
    new URL("../../server/package.json", import.meta.url),
)("drizzle-orm/pg-core");
const dialect = new PgDialect();
const verifier = "v".repeat(43);
const challenge = createHash("sha256").update(verifier).digest("base64url");
const requestId = "r".repeat(43);
const code = "c".repeat(43);
const codeHash = createHash("sha256").update(code).digest("hex");
const headers = {
    Origin: nativeApp.origin,
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
};

function post(path: string, body: unknown, extraHeaders = headers) {
    return NativeAuthRouter.request(`http://api.test${path}`, {
        method: "POST",
        headers: extraHeaders,
        body: JSON.stringify(body),
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    mocks.insert.mockResolvedValue(undefined);
    mocks.validateSession.mockResolvedValue({ session: null, user: null });
    mocks.setSession.mockResolvedValue(undefined);
});

describe("Android OAuth handoff", () => {
    test("completion issues a fresh return code and stores only its hash", async () => {
        mocks.complete.mockResolvedValue([{ id: requestId }]);
        NativeAuthRouter.get("/test-callback", (c) =>
            finishNativeOAuth(
                c,
                {
                    user: null,
                    request: {
                        id: requestId,
                        provider: "google",
                        challenge,
                        codeHash: null,
                        linkSessionId: null,
                        userId: null,
                        started: true,
                        completed: false,
                        error: null,
                        expiresAt: new Date(Date.now() + 600_000),
                    },
                },
                { user: { id: "owner" } },
            ),
        );
        const response = await NativeAuthRouter.request("http://api.test/test-callback", {
            headers,
        });
        const url = new URL(response.headers.get("Location")!);
        const returnedCode = url.searchParams.get("code")!;
        expect(returnedCode).toMatch(/^[A-Za-z0-9_-]{43}$/);
        expect(returnedCode).not.toBe(requestId);
        expect(mocks.complete.mock.calls[0][0]).toMatchObject({
            codeHash: createHash("sha256").update(returnedCode).digest("hex"),
            userId: "owner",
            completed: true,
        });
        expect(JSON.stringify(mocks.complete.mock.calls)).not.toContain(returnedCode);
        expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
        expect(response.headers.get("Cache-Control")).toBe("no-store");
        expect(
            mocks.complete.mock.calls[0][0].expiresAt.getTime() - Date.now(),
        ).toBeLessThanOrEqual(120_000);
    });

    test.each([
        "google",
        "discord",
    ])("starts %s with a bounded verifier challenge, without credentials in the return URL", async (provider) => {
        const response = await post("/request", { provider, challenge, link: false });
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data).toEqual({ request: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/) });
        const saved = mocks.insert.mock.calls[0][0];
        expect(saved).toMatchObject({
            id: data.request,
            provider,
            challenge,
            linkSessionId: null,
        });
        expect(saved.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(600_000);
        expect(saved.expiresAt.getTime() - Date.now()).toBeGreaterThan(590_000);
        expect(response.headers.get("Cache-Control")).toBe("no-store");
        expect(mocks.setSession).not.toHaveBeenCalled();
    });

    test("rejects a request from another web origin", async () => {
        const result = await post(
            "/request",
            { provider: "google", challenge, link: false },
            { ...headers, Origin: "https://evil.example" },
        );
        expect(result.status).toBe(403);
        expect(mocks.insert).not.toHaveBeenCalled();
    });

    test("requires the CSRF header", async () => {
        const result = await post(
            "/request",
            { provider: "google", challenge, link: false },
            { ...headers, "X-Requested-With": "" },
        );
        expect(result.status).toBe(403);
    });

    test.each([
        "",
        "short",
        "x".repeat(44),
    ])("rejects malformed PKCE challenge %s", async (invalid) => {
        expect(
            (
                await post("/request", {
                    provider: "google",
                    challenge: invalid,
                    link: false,
                })
            ).status,
        ).toBe(400);
        expect(mocks.insert).not.toHaveBeenCalled();
    });

    test("linking requires an existing app session", async () => {
        expect(
            (await post("/request", { provider: "discord", challenge, link: true }))
                .status,
        ).toBe(401);
        expect(mocks.insert).not.toHaveBeenCalled();
    });

    test("binds linking to the validated app session, never a submitted user ID", async () => {
        mocks.validateSession.mockResolvedValue({
            session: { id: "hashed-session" },
            user: { id: "owner" },
        });
        const result = await post(
            "/request",
            { provider: "discord", challenge, link: true, userId: "attacker" },
            { ...headers, Cookie: "session=secret" },
        );
        expect(result.status).toBe(200);
        expect(mocks.insert.mock.calls[0][0]).toMatchObject({
            linkSessionId: "hashed-session",
        });
        expect(mocks.insert.mock.calls[0][0]).not.toHaveProperty("userId");
    });

    test("exchange atomically checks ID, PKCE, completion and expiry, then cannot be replayed", async () => {
        let consumed = false;
        mocks.consume.mockImplementation((condition) => {
            const query = dialect.sqlToQuery(condition);
            expect(query.sql).toContain('"challenge" =');
            expect(query.sql).toContain('"code_hash" =');
            expect(query.sql).toContain('"completed" =');
            expect(query.sql).toContain('"expires_at" >');
            expect(query.params).toEqual([
                requestId,
                challenge,
                codeHash,
                true,
                expect.any(String),
            ]);
            expect(Math.abs(Date.parse(query.params[4]) - Date.now())).toBeLessThan(1000);
            if (consumed) return [];
            consumed = true;
            return [{ userId: "owner", error: null }];
        });
        expect(
            (await post("/exchange", { request: requestId, code, verifier })).status,
        ).toBe(200);
        expect(mocks.setSession).toHaveBeenCalledWith("owner", expect.anything());
        expect(
            (await post("/exchange", { request: requestId, code, verifier })).status,
        ).toBe(400);
        expect(mocks.setSession).toHaveBeenCalledTimes(1);
    });

    test("a wrong verifier does not consume a valid request", async () => {
        mocks.consume.mockImplementation((condition) => {
            const query = dialect.sqlToQuery(condition);
            return query.params[1] === challenge
                ? [{ userId: "owner", error: null }]
                : [];
        });
        expect(
            (
                await post("/exchange", {
                    request: requestId,
                    code,
                    verifier: "w".repeat(43),
                })
            ).status,
        ).toBe(400);
        expect(mocks.setSession).not.toHaveBeenCalled();
        expect(
            (await post("/exchange", { request: requestId, code, verifier })).status,
        ).toBe(200);
    });

    test.for([
        [],
        [{ userId: null, error: "login_cancelled" }],
        [{ userId: "owner", error: "login_failed" }],
    ])("does not sign in with expired, cancelled or failed requests", async (rows) => {
        mocks.consume.mockResolvedValue(rows);
        expect(
            (await post("/exchange", { request: requestId, code, verifier })).status,
        ).toBe(400);
        expect(mocks.setSession).not.toHaveBeenCalled();
    });

    test("the initiating request and verifier alone cannot obtain a session", async () => {
        expect((await post("/exchange", { request: requestId, verifier })).status).toBe(
            400,
        );
        expect(mocks.consume).not.toHaveBeenCalled();
        expect(mocks.setSession).not.toHaveBeenCalled();
    });

    test("an incorrect return code is rejected even with the correct verifier", async () => {
        mocks.consume.mockImplementation((condition) => {
            const query = dialect.sqlToQuery(condition);
            return query.params[2] === codeHash ? [{ userId: "owner", error: null }] : [];
        });
        expect(
            (
                await post("/exchange", {
                    request: requestId,
                    verifier,
                    code: "x".repeat(43),
                })
            ).status,
        ).toBe(400);
        expect(mocks.setSession).not.toHaveBeenCalled();
    });
});
