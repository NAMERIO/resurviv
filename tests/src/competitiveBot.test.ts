import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    staff: false,
    owner: false,
    admin: false,
    add: vi.fn(),
    validate: vi.fn(),
    void: vi.fn(),
    season: vi.fn(),
    deny: vi.fn(),
}));
vi.mock("../../bot/src/config", () => ({ API_URL: "http://127.0.0.1/private" }));
vi.mock("../../bot/src/commands/helpers", () => ({
    sendNoPermissionMessage: mocks.deny,
}));
vi.mock("../../bot/src/utils", () => ({
    Command: {
        WhrAdd: "whr_add",
        WhrVoid: "whr_void",
        WhrSeason: "whr_season",
        WhrLeaderboard: "whr_leaderboard",
    },
    hasBotPermission: () => mocks.staff,
    hasOwnerPermission: () => mocks.owner,
    isAdmin: () => mocks.admin,
    honoClient: {
        competitive: {
            add: { $post: mocks.add },
            "validate-players": { $post: mocks.validate },
            void: { $post: mocks.void },
            season: { $post: mocks.season },
        },
    },
}));

import {
    whrAddHandler,
    whrLeaderboardHandler,
    whrSeasonHandler,
    whrVoidHandler,
} from "../../bot/src/commands/whr";

import { handleWhrAddInteraction } from "../../bot/src/commands/whr-add";

const interaction = (options: Record<string, string>) =>
    ({
        id: "123456789012345678",
        user: { id: "123456789012345679" },
        options: { getString: (name: string) => options[name] ?? null },
        deferReply: vi.fn(),
        editReply: vi.fn(),
    }) as any;

describe("competitive bot permissions and input", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.staff = false;
        mocks.owner = false;
        mocks.admin = false;
    });
    test("unprivileged users cannot add, void or start seasons", async () => {
        const request = interaction({});
        await whrAddHandler.execute(request);
        await whrVoidHandler.execute(request);
        await whrSeasonHandler.execute(request);
        expect(mocks.deny).toHaveBeenCalledTimes(3);
        expect(mocks.add).not.toHaveBeenCalled();
        expect(mocks.void).not.toHaveBeenCalled();
        expect(mocks.season).not.toHaveBeenCalled();
    });
    test("staff cannot reset seasons unless owner/admin", async () => {
        mocks.staff = true;
        await whrSeasonHandler.execute(interaction({ name: "New season" }));
        expect(mocks.deny).toHaveBeenCalledOnce();
        expect(mocks.season).not.toHaveBeenCalled();
    });
    test.each([
        false,
        true,
    ])("staff/admin without the owner role cannot add or void (admin=%s)", async (admin) => {
        mocks.staff = true;
        mocks.admin = admin;
        const request = interaction({});
        await whrAddHandler.execute(request);
        await whrVoidHandler.execute(request);
        expect(mocks.deny).toHaveBeenCalledTimes(2);
        expect(mocks.add).not.toHaveBeenCalled();
        expect(mocks.void).not.toHaveBeenCalled();
    });
    test("owner role can void a result", async () => {
        mocks.staff = true;
        mocks.owner = true;
        mocks.void.mockResolvedValueOnce(Response.json({ message: "Match voided." }));
        await whrVoidHandler.execute(
            interaction({ match: "match-id", reason: "Wrong score" }),
        );
        expect(mocks.void).toHaveBeenCalledOnce();
        expect(mocks.deny).not.toHaveBeenCalled();
    });
    test("leaderboard is public without staff, owner or admin permissions", async () => {
        const fetchBoard = vi.fn().mockResolvedValue(
            Response.json({
                season: { id: 1, name: "Season 1" },
                players: [],
                placementGames: 3,
            }),
        );
        vi.stubGlobal("fetch", fetchBoard);
        try {
            const request = interaction({});
            request.options.getInteger = () => null;
            await whrLeaderboardHandler.execute(request);
            expect(fetchBoard).toHaveBeenCalledOnce();
            expect(request.deferReply).toHaveBeenCalledWith();
            expect(request.editReply.mock.calls[0][0].content).toContain("Season 1");
            expect(mocks.deny).not.toHaveBeenCalled();
        } finally {
            vi.unstubAllGlobals();
        }
    });
});

let nextId = 123456789012345700n;
function formInteraction(
    kind: "command" | "button" | "modal",
    customId = "",
    values: Record<string, string> = {},
) {
    const request: any = {
        id: String(nextId++),
        user: { id: "123456789012345679" },
        guildId: "guild",
        channelId: "channel",
        customId,
        deferred: false,
        replied: false,
        isButton: () => kind === "button",
        isModalSubmit: () => kind === "modal",
        reply: vi.fn(() => {
            request.replied = true;
        }),
        deferReply: vi.fn(() => {
            request.deferred = true;
        }),
        editReply: vi.fn(),
        followUp: vi.fn(),
        showModal: vi.fn(),
        update: vi.fn(),
        fields: { getTextInputValue: (key: string) => values[key] ?? "" },
    };
    return request;
}
async function start(mode = "deathmatch", teams = 2, size = 1, date = "2026-08-01") {
    const request = formInteraction("command");
    request.options = {
        getString: (key: string) =>
            key === "mode" ? mode : key === "date" ? date : null,
        getInteger: (key: string) => (key === "teams" ? teams : size),
    };
    await whrAddHandler.execute(request);
    return request;
}
function modalId(request: any) {
    return request.showModal.mock.calls.at(-1)[0].toJSON().custom_id;
}
function buttonId(request: any, action: string) {
    const controls = request.editReply.mock.calls.at(-1)[0].components;
    return controls
        .flatMap((row: any) => row.toJSON().components)
        .find((button: any) => button.custom_id.endsWith(`:${action}`)).custom_id;
}
async function click(id: string) {
    const button = formInteraction("button", id);
    await handleWhrAddInteraction(button);
    return button;
}
async function submit(
    id: string,
    slugs: string[],
    result: string,
    chooseFirstWinner = true,
) {
    const values = Object.fromEntries(slugs.map((slug, i) => [`player_${i}`, slug]));
    const request = formInteraction("modal", id, { ...values, result });
    await handleWhrAddInteraction(request);
    // Most workflow tests finish the new required winner step by choosing Team 1.
    // Outcome-specific tests opt out to inspect and operate the choice themselves.
    const winner = request.editReply.mock.calls
        .at(-1)?.[0]
        .components?.flatMap((row: any) => row.toJSON().components)
        .find((button: any) => button.custom_id.endsWith(":winner-0"));
    if (chooseFirstWinner && winner) return click(winner.custom_id);
    return request;
}

describe("guided competitive entry", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.staff = true;
        mocks.owner = true;
        mocks.admin = false;
        mocks.validate.mockImplementation(async () => Response.json({ valid: true }));
        mocks.add.mockImplementation(async () =>
            Response.json({ id: "match-id", duplicate: false }),
        );
    });
    test("command exposes mode, team count and team size; modal has individual slug fields", async () => {
        const command = whrAddHandler.command.toJSON();
        expect(command.options?.map((option) => option.name)).toEqual([
            "mode",
            "teams",
            "players_per_team",
            "date",
        ]);
        const request = await start("deathmatch", 4, 4);
        const modal = request.showModal.mock.calls[0][0].toJSON();
        expect(modal.components).toHaveLength(5);
        expect(modal.components[0].components[0].label).toBe(
            "Team 1 Player 1 - game slug",
        );
        expect(modal.components[3].components[0].label).toBe(
            "Team 1 Player 4 - game slug",
        );
        expect(modal.components[4].components[0].label).toBe("Team 1 score");
        expect(mocks.add).not.toHaveBeenCalled();
    });
    test("valid slugs and scores produce one public scoreboard with the original actor and request key", async () => {
        const initial = await start("deathmatch", 2, 2);
        const first = await submit(modalId(initial), ["alice-slug", "bob-slug"], "10");
        expect(mocks.add).not.toHaveBeenCalled();
        const next = await click(buttonId(first, "team"));
        const last = await submit(modalId(next), ["carol-slug", "dave-slug"], "7");
        expect(mocks.validate.mock.calls.at(-1)[0]).toEqual({
            json: { slugs: ["carol-slug", "dave-slug"] },
        });
        expect(mocks.add).toHaveBeenCalledTimes(1);
        expect(mocks.add.mock.calls[0][0]).toEqual({
            json: {
                teams: [
                    ["alice-slug", "bob-slug"],
                    ["carol-slug", "dave-slug"],
                ],
                scores: [10, 7],
                winnerTeam: 0,
                reference: `discord-${initial.id}`,
                playedOn: "2026-08-01",
                note: "",
                executorId: initial.user.id,
                requestId: initial.id,
            },
        });
        const publicPost = last.followUp.mock.calls[0][0];
        expect(publicPost.flags).toBeUndefined();
        expect(publicPost.allowedMentions).toEqual({ parse: [] });
        expect(publicPost.embeds[0].toJSON().description).toContain(
            "Team 1 - Score: 10 (Winner)",
        );
        expect(publicPost.embeds[0].toJSON().description).toContain(
            "carol-slug + dave-slug",
        );
        await submit(modalId(next), ["carol-slug", "dave-slug"], "7");
        expect(mocks.add).toHaveBeenCalledTimes(1);
    });
    test("incorrect game slugs can be corrected without saving or posting a match", async () => {
        mocks.validate.mockResolvedValueOnce(
            new Response('Incorrect slug: "missing" does not exist.', { status: 400 }),
        );
        const initial = await start();
        const failed = await submit(modalId(initial), ["missing"], "10");
        expect(failed.editReply.mock.calls[0][0].content).toContain("does not exist");
        expect(failed.followUp).not.toHaveBeenCalled();
        expect(mocks.add).not.toHaveBeenCalled();
        const retry = await click(buttonId(failed, "team"));
        expect(
            retry.showModal.mock.calls[0][0].toJSON().components[0].components[0].value,
        ).toBe("missing");
        await submit(modalId(retry), ["alice"], "10");
        expect(mocks.validate.mock.calls.at(-1)[0]).toEqual({
            json: { slugs: ["alice"] },
        });
    });
    test("Battle Royale orders teams by their unique finishing places", async () => {
        const initial = await start("battle_royale", 3);
        expect(
            initial.showModal.mock.calls[0][0].toJSON().components[1].components[0].label,
        ).toBe("Team 1 finishing place");
        const first = await submit(modalId(initial), ["alice"], "3");
        const next = await click(buttonId(first, "team"));
        const duplicate = await submit(modalId(next), ["bob"], "3");
        expect(duplicate.editReply.mock.calls[0][0].content).toContain(
            "already assigned",
        );
        const second = await submit(modalId(next), ["bob"], "1");
        const final = await click(buttonId(second, "team"));
        const last = await submit(modalId(final), ["carol"], "2");
        expect(mocks.add.mock.calls[0][0].json.teams).toEqual([
            ["bob"],
            ["carol"],
            ["alice"],
        ]);
        expect(mocks.add.mock.calls[0][0].json.scores).toBeUndefined();
        expect(last.followUp.mock.calls[0][0].embeds[0].toJSON().description).toContain(
            "Team 2 - Place: #1 (Winner)",
        );
    });
    test("duplicates, noninteger scores and all-zero scores cannot be saved", async () => {
        const initial = await start();
        const invalid = await submit(modalId(initial), ["alice"], "1.5");
        expect(invalid.editReply.mock.calls[0][0].content).toContain("whole-number");
        const first = await submit(modalId(initial), ["alice"], "0");
        const next = await click(buttonId(first, "team"));
        const duplicate = await submit(modalId(next), ["alice"], "1");
        expect(duplicate.editReply.mock.calls[0][0].content).toContain(
            "cannot appear twice",
        );
        const zero = await submit(modalId(next), ["bob"], "0");
        expect(zero.editReply.mock.calls[0][0].content).toContain("greater than zero");
        expect(mocks.add).not.toHaveBeenCalled();
    });
    test("only the original referee in the original channel with current permissions can continue", async () => {
        const initial = await start();
        const first = await submit(modalId(initial), ["alice"], "5");
        const id = buttonId(first, "team");
        for (const change of [
            { user: { id: "other" } },
            { channelId: "other" },
            { guildId: "other" },
        ]) {
            const request = Object.assign(formInteraction("button", id), change);
            await handleWhrAddInteraction(request);
            expect(request.showModal).not.toHaveBeenCalled();
            expect(request.reply).toHaveBeenCalledOnce();
        }
        mocks.owner = false;
        const request = await click(id);
        expect(mocks.deny).toHaveBeenCalledOnce();
        expect(request.showModal).not.toHaveBeenCalled();
        expect(mocks.add).not.toHaveBeenCalled();
    });
    test("public-post retries reuse the saved result without recording it twice", async () => {
        const initial = await start();
        const first = await submit(modalId(initial), ["alice"], "10");
        const next = await click(buttonId(first, "team"));
        const last = formInteraction("modal", modalId(next), {
            player_0: "bob",
            result: "8",
        });
        await handleWhrAddInteraction(last);
        expect(mocks.add).not.toHaveBeenCalled();
        const draw = formInteraction("button", buttonId(last, "draw"));
        draw.followUp.mockRejectedValueOnce(new Error("Cannot send message"));
        await handleWhrAddInteraction(draw);
        expect(draw.editReply.mock.calls.at(-1)[0].content).toContain("result is saved");
        const retry = await click(buttonId(draw, "publish"));
        expect(mocks.add).toHaveBeenCalledTimes(1);
        expect(mocks.add.mock.calls[0][0].json).toMatchObject({
            scores: [10, 8],
            winnerTeam: -1,
        });
        expect(retry.followUp).toHaveBeenCalledOnce();
        expect(retry.followUp.mock.calls[0][0].embeds[0].toJSON().description).toContain(
            "(Draw)",
        );
    });
    test("uncertain save failures freeze the payload and retry with the same key", async () => {
        const initial = await start();
        const first = await submit(modalId(initial), ["alice"], "9");
        const next = await click(buttonId(first, "team"));
        mocks.add.mockRejectedValueOnce(new Error("Connection lost"));
        const last = await submit(modalId(next), ["bob"], "6");
        expect(
            last.editReply.mock.calls.at(-1)[0].components[0].toJSON().components,
        ).toHaveLength(1);
        await click(buttonId(last, "publish"));
        expect(mocks.add.mock.calls[1][0]).toEqual(mocks.add.mock.calls[0][0]);
    });
    test("a lower-scoring winner requires an authorized choice and stays frozen on retry", async () => {
        const initial = await start();
        const first = await submit(modalId(initial), ["namerio"], "10");
        const next = await click(buttonId(first, "team"));
        const last = await submit(modalId(next), ["clover"], "5", false);
        expect(mocks.add).not.toHaveBeenCalled();
        expect(last.followUp).not.toHaveBeenCalled();
        const id = buttonId(last, "winner-1");
        mocks.owner = false;
        await click(id);
        expect(mocks.deny).toHaveBeenCalledOnce();
        expect(mocks.add).not.toHaveBeenCalled();
        mocks.owner = true;
        mocks.add.mockRejectedValueOnce(new Error("Connection lost"));
        const winner = await click(id);
        const retry = await click(buttonId(winner, "publish"));
        expect(mocks.add.mock.calls[0][0].json).toMatchObject({
            scores: [10, 5],
            winnerTeam: 1,
        });
        expect(mocks.add.mock.calls[1][0]).toEqual(mocks.add.mock.calls[0][0]);
        const description =
            retry.followUp.mock.calls[0][0].embeds[0].toJSON().description;
        expect(description).toContain("Team 2 - Score: 5 (Winner)");
        expect(description).not.toContain("Team 1 - Score: 10 (Winner)");
        expect(description).not.toContain("(Draw)");
        await click(id);
        expect(mocks.add).toHaveBeenCalledTimes(2);
    });
    test("32 tied teams have paged winner buttons within Discord's component limits", async () => {
        let current = await start("deathmatch", 32);
        let last: any;
        for (let team = 0; team < 32; team++) {
            last = await submit(modalId(current), [`player-${team}`], "5", false);
            if (team < 31) current = await click(buttonId(last, "team"));
        }
        expect(mocks.add).not.toHaveBeenCalled();
        let payload = last.editReply.mock.calls.at(-1)[0];
        for (let page = 0; page < 2; page++) {
            expect(payload.components.length).toBeLessThanOrEqual(5);
            const rows = payload.components.map((row: any) => row.toJSON());
            for (const row of rows) expect(row.components.length).toBeLessThanOrEqual(5);
            const nextId = rows
                .flatMap((row: any) => row.components)
                .find((button: any) =>
                    button.custom_id.endsWith(":winner-next"),
                ).custom_id;
            const next = await click(nextId);
            payload = next.update.mock.calls[0][0];
        }
        const winnerId = payload.components
            .flatMap((row: any) => row.toJSON().components)
            .find((button: any) => button.custom_id.endsWith(":winner-31")).custom_id;
        await click(winnerId);
        expect(mocks.add.mock.calls[0][0].json.winnerTeam).toBe(31);
    });
    test("editing a previous team invalidates old forms and keeps its values", async () => {
        const initial = await start();
        const first = await submit(modalId(initial), ["alice"], "10");
        const outdated = await click(buttonId(first, "team"));
        const back = await click(buttonId(first, "back"));
        expect(
            back.showModal.mock.calls[0][0].toJSON().components[0].components[0].value,
        ).toBe("alice");
        const stale = await submit(modalId(outdated), ["bob"], "7");
        expect(stale.reply.mock.calls[0][0].content).toContain("out of date");
        const corrected = await submit(modalId(back), ["carol"], "8");
        const next = await click(buttonId(corrected, "team"));
        await submit(modalId(next), ["bob"], "7");
        expect(mocks.add.mock.calls[0][0].json.teams).toEqual([["carol"], ["bob"]]);
    });
    test("simultaneous final submissions save and publish only once", async () => {
        const initial = await start();
        const first = await submit(modalId(initial), ["alice"], "10");
        const next = await click(buttonId(first, "team"));
        const replies = await Promise.all([
            submit(modalId(next), ["bob"], "7"),
            submit(modalId(next), ["bob"], "7"),
        ]);
        expect(mocks.add).toHaveBeenCalledTimes(1);
        expect(
            replies.reduce((count, reply) => count + reply.followUp.mock.calls.length, 0),
        ).toBe(1);
    });
    test("large scoreboards fit Discord limits and preserve every team's result", async () => {
        let current = await start("deathmatch", 32, 4);
        let last: any;
        for (let team = 0; team < 32; team++) {
            const slugs = Array.from({ length: 4 }, (_, player) =>
                `${team}_${player}_${"a".repeat(95)}`.slice(0, 100),
            );
            last = await submit(modalId(current), slugs, String(team + 1));
            if (team < 31) current = await click(buttonId(last, "team"));
        }
        expect(mocks.add).toHaveBeenCalledTimes(1);
        expect(last.followUp.mock.calls.length).toBeGreaterThan(1);
        const pages = last.followUp.mock.calls.map(([payload]: any[]) =>
            payload.embeds[0].toJSON(),
        );
        for (const page of pages)
            expect(page.description.length).toBeLessThanOrEqual(3500);
        expect(pages.map((page: any) => page.description).join("\n")).toContain(
            "Team 32 - Score: 32",
        );
        expect(pages.map((page: any) => page.description).join("\n")).toContain(
            "Team 1 - Score: 1 (Winner)",
        );
    });
    test("invalid team sizes and impossible dates never open a form", async () => {
        for (const [teams, size, date] of [
            [1, 1, "2026-08-01"],
            [2, 5, "2026-08-01"],
            [2, 1, "2026-02-30"],
        ] as const) {
            const invalid = await start("deathmatch", teams, size, date);
            expect(invalid.showModal).not.toHaveBeenCalled();
            expect(invalid.reply).toHaveBeenCalledOnce();
        }
    });
    test("cancel and expiry leave no result", async () => {
        const initial = await start();
        const first = await submit(modalId(initial), ["alice"], "9");
        const nextId = buttonId(first, "team");
        await click(buttonId(first, "cancel"));
        const stale = await click(nextId);
        expect(stale.reply.mock.calls[0][0].content).toContain("expired");
        const other = await start();
        const now = Date.now();
        const clock = vi.spyOn(Date, "now").mockReturnValue(now + 31 * 60 * 1000);
        try {
            const expired = await submit(modalId(other), ["alice"], "9");
            expect(expired.reply.mock.calls[0][0].content).toContain("expired");
        } finally {
            clock.mockRestore();
        }
        expect(mocks.add).not.toHaveBeenCalled();
    });
});
