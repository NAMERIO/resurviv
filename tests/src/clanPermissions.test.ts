import { beforeEach, expect, test, vi } from "vitest";
import type { ClanMemberRole } from "../../shared/types/clan";
import {
    canKickClanMember,
    canSetClanMemberRole,
    type EffectiveClanRole,
} from "../../shared/utils/clanPermissions";

const mocks = vi.hoisted(() => {
    const rows = () => {
        const query: any = {};
        for (const method of [
            "from",
            "where",
            "innerJoin",
            "orderBy",
            "limit",
            "values",
        ]) {
            query[method] = () => query;
        }
        query.then = (resolve: any, reject: any) =>
            Promise.resolve([]).then(resolve, reject);
        return query;
    };
    const set = vi.fn(() => rows());
    return {
        membership: vi.fn(),
        clan: vi.fn(),
        set,
        update: vi.fn(() => ({ set })),
        remove: vi.fn(() => rows()),
        select: vi.fn(() => rows()),
        insert: vi.fn(() => rows()),
        notify: vi.fn(),
    };
});

vi.mock("../../server/src/config", () => ({ Config: { regions: { na: {} } } }));
vi.mock("../../server/src/api/apiServer", () => ({
    server: { notifyUsersSocialEvent: mocks.notify },
}));
vi.mock("../../server/src/utils/serverHelpers", () => ({
    checkForBadWords: () => false,
    validateUserName: (name: string) => ({ validName: name, originalWasInvalid: false }),
}));
vi.mock("../../server/src/api/auth/middleware", () => ({
    databaseEnabledMiddleware: (_c: any, next: any) => next(),
    rateLimitMiddleware: () => (_c: any, next: any) => next(),
    authMiddleware: (c: any, next: any) => {
        c.set("user", { id: "actor", username: "Actor" });
        return next();
    },
    validateParams: (schema: any) => async (c: any, next: any) => {
        const result = schema.safeParse(await c.req.json());
        if (!result.success) return c.json({ error: "Invalid params" }, 400);
        c.req.addValidatedData("json", result.data);
        return next();
    },
}));
vi.mock("../../server/src/api/db", () => ({
    db: {
        query: {
            clanMembersTable: { findFirst: mocks.membership },
            clansTable: { findFirst: mocks.clan },
            clanJoinRequestsTable: { findFirst: vi.fn() },
            usersTable: { findFirst: vi.fn(async () => ({ username: "Target" })) },
        },
        select: mocks.select,
        update: mocks.update,
        delete: mocks.remove,
        insert: mocks.insert,
        execute: vi.fn(async () => []),
    },
}));

import { ClanRouter } from "../../server/src/api/routes/clan/ClanRouter";

const clanId = "32ab2d28-76e8-4d40-89a0-024de048d280";

function asRole(role: EffectiveClanRole | null) {
    const actor = role
        ? { clanId, userId: "actor", role: role === "owner" ? "member" : role }
        : undefined;
    mocks.membership.mockResolvedValue(actor);
    mocks.clan.mockResolvedValue({
        id: clanId,
        ownerId: role === "owner" ? "actor" : "owner",
        name: "Clan",
        slug: "clan",
        icon: "emote_surviv",
        tagColor: "",
        region: "na",
        font: "default",
        bold: true,
        discordInviteUrl: "",
        isLocked: false,
        createdAt: new Date(),
    });
    return actor;
}

function post(path: string, body: object = {}) {
    return ClanRouter.request(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    asRole("admin");
});

test.for([
    "owner",
    "admin",
] as const)("%s can save all clan customization fields", async (role) => {
    asRole(role);
    const settings = {
        name: "New Clan",
        icon: "emote_whistle",
        tagColor: "#ff0000,#00ff00",
        region: "na",
        font: "pixel",
        bold: false,
        discordInviteUrl: "https://discord.gg/example",
        isLocked: true,
    };
    // The uniqueness check must not find an existing clan with the new name.
    const clan = await mocks.clan();
    mocks.clan.mockResolvedValueOnce(clan).mockResolvedValueOnce(undefined);
    const response = await post("/update", settings);
    expect(response.status).toBe(200);
    expect((await response.json()).success).toBe(true);
    const { region: _unchangedRegion, ...changedSettings } = settings;
    expect(mocks.set).toHaveBeenCalledWith({
        ...changedSettings,
        slug: "new-clan",
    });
});

test.for([
    "mod",
    "member",
    null,
] as const)("%s cannot customize the clan or claim admin through request data", async (role) => {
    asRole(role);
    const response = await post("/update", {
        icon: "emote_whistle",
        role: "admin",
        ownerId: "actor",
    });
    expect(response.status).toBe(403);
    expect(mocks.update).not.toHaveBeenCalled();
});

test.for([
    "/transfer",
    "/delete",
])("Admins cannot call %s even with a forged request", async (path) => {
    const response = await post(path, { newOwnerId: "target" });
    expect(response.status).toBe(403);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
});

test("Only the owner can appoint an admin through the API", async () => {
    const target = { clanId, userId: "target", role: "member" };
    for (const role of ["admin", "mod", "member", "owner"] as const) {
        const actor = asRole(role);
        mocks.membership.mockResolvedValueOnce(actor).mockResolvedValueOnce(target);
        const response = await post("/set_member_role", {
            memberId: "target",
            role: "admin",
        });
        expect(response.status).toBe(role === "owner" ? 200 : 403);
    }
    expect(mocks.set).toHaveBeenCalledExactlyOnceWith({ role: "admin" });
});

test.for([
    "member",
    "mod",
] as const)("Admins can demote another admin to %s", async (role) => {
    const actor = asRole("admin");
    mocks.membership.mockResolvedValueOnce(actor).mockResolvedValueOnce({
        clanId,
        userId: "target",
        role: "admin",
    });
    const response = await post("/set_member_role", { memberId: "target", role });
    expect(response.status).toBe(200);
    expect(mocks.set).toHaveBeenCalledWith({ role });
});

test("Admins can remove another admin but cannot change or kick the owner", async () => {
    const actor = asRole("admin");
    mocks.membership.mockResolvedValueOnce(actor).mockResolvedValueOnce({
        clanId,
        userId: "target",
        role: "admin",
    });
    expect((await post("/kick", { memberId: "target" })).status).toBe(200);
    mocks.update.mockClear();
    mocks.remove.mockClear();
    for (const [path, body] of [
        ["/kick", { memberId: "owner" }],
        ["/set_member_role", { memberId: "owner", role: "member" }],
    ] as const) {
        mocks.membership.mockResolvedValueOnce(actor).mockResolvedValueOnce({
            clanId,
            userId: "owner",
            role: "member",
        });
        expect((await post(path, body)).status).toBeGreaterThanOrEqual(400);
    }
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
});

test("Client role controls use the same restrictions as the API", () => {
    for (const target of ["member", "mod", "admin"] as const) {
        expect(canKickClanMember("admin", target)).toBe(true);
        expect(canSetClanMemberRole("admin", target, "admin")).toBe(false);
        for (const next of ["member", "mod"] as ClanMemberRole[]) {
            expect(canSetClanMemberRole("admin", target, next)).toBe(true);
        }
    }
    expect(canKickClanMember("admin", "owner")).toBe(false);
    expect(canSetClanMemberRole("admin", "owner", "member")).toBe(false);
});
