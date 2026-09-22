import { describe, expect, test } from "vitest";
import { applyArenaRosterAction } from "../../server/src/utils/arenaRoster";
import type { ArenaTeam } from "../../shared/defs/miniGame";
import { zTeamClientMsg } from "../../shared/types/team";

function lobby(count = 7, battleRoyale = false) {
    const players = Array.from({ length: count }, (_, id) => ({
        id,
        isLeader: id === 0,
        inGame: false,
    }));
    type Player = (typeof players)[number];
    let code = 0;
    return {
        players,
        data: { arena: true, findingGame: false, maxPlayers: 80 },
        arenaTeams: new Map<Player, ArenaTeam>(
            players.slice(0, 2).map((player) => [player, "A"]),
        ),
        arenaSpectators: new Set(players.slice(2)),
        battleRoyaleTeams: new Map<Player, string>([[players[0], "OLD1"]]),
        isBattleRoyaleArena: () => battleRoyale,
        getActiveArenaTeams: (): ArenaTeam[] => ["A", "B", "C"],
        getArenaTeamCapacity: () => 2,
        getBattleRoyaleTeamCapacity: () => 3,
        generateBattleRoyaleTeamCode: () => `NEW${++code}`,
    };
}

describe("private lobby roster controls", () => {
    test.each([
        "spectateAll",
        "shuffleTeams",
    ] as const)("%s rejects nonowners, outsiders, public rooms and active matches", (action) => {
        for (const condition of [
            "nonowner",
            "outsider",
            "public",
            "starting",
            "playing",
        ]) {
            const room = lobby();
            let actor = room.players[0];
            if (condition === "nonowner") actor = room.players[1];
            if (condition === "outsider")
                actor = { id: 99, isLeader: true, inGame: false };
            if (condition === "public") room.data.arena = false;
            if (condition === "starting") room.data.findingGame = true;
            if (condition === "playing") room.players[3].inGame = true;
            const before = {
                teams: [...room.arenaTeams],
                spectators: [...room.arenaSpectators],
                br: [...room.battleRoyaleTeams],
            };
            expect(applyArenaRosterAction(room, actor, action)).toBe(false);
            expect({
                teams: [...room.arenaTeams],
                spectators: [...room.arenaSpectators],
                br: [...room.battleRoyaleTeams],
            }).toEqual(before);
        }
    });
    test.each([
        false,
        true,
    ])("Spectate All clears team assignments and includes the owner (BR=%s)", (br) => {
        const room = lobby(7, br);
        expect(applyArenaRosterAction(room, room.players[0], "spectateAll")).toBe(true);
        expect(room.arenaSpectators).toEqual(new Set(room.players));
        expect(room.arenaTeams.size).toBe(0);
        expect(room.battleRoyaleTeams.size).toBe(0);
    });
    test.each([
        2, 5, 6, 9,
    ])("shuffle balances teams, respects capacity and leaves overflow spectating (%s players)", (count) => {
        const room = lobby(count);
        const originalOrder = [...room.players];
        applyArenaRosterAction(room, room.players[0], "spectateAll");
        expect(applyArenaRosterAction(room, room.players[0], "shuffleTeams")).toBe(true);
        const sizes = room
            .getActiveArenaTeams()
            .map(
                (team) =>
                    [...room.arenaTeams.values()].filter((value) => value === team)
                        .length,
            );
        expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
        expect(Math.max(...sizes)).toBeLessThanOrEqual(2);
        expect(room.arenaTeams.size).toBe(Math.min(count, 6));
        expect(room.arenaSpectators.size).toBe(Math.max(0, count - 6));
        expect(
            [...room.arenaTeams.keys()].every((p) => !room.arenaSpectators.has(p)),
        ).toBe(true);
        expect(new Set([...room.arenaTeams.keys(), ...room.arenaSpectators])).toEqual(
            new Set(room.players),
        );
        expect(room.players).toEqual(originalOrder);
        expect(room.battleRoyaleTeams.size).toBe(0);
    });
    test("single-team minigames only fill their available team", () => {
        const room = lobby();
        room.getActiveArenaTeams = () => ["A"];
        applyArenaRosterAction(room, room.players[0], "shuffleTeams");
        expect([...room.arenaTeams.values()]).toEqual(["A", "A"]);
        expect(room.arenaSpectators.size).toBe(5);
    });
    test("Battle Royale shuffle creates balanced new party codes within the player and team limits", () => {
        const room = lobby(9, true);
        room.data.maxPlayers = 8;
        applyArenaRosterAction(room, room.players[0], "shuffleTeams");
        const codes = [...room.battleRoyaleTeams.values()];
        expect(codes).not.toContain("OLD1");
        const counts = [...new Set(codes)]
            .map((code) => codes.filter((v) => v === code).length)
            .sort();
        expect(counts).toEqual([2, 3, 3]);
        expect(room.arenaTeams.size).toBe(0);
        expect(room.arenaSpectators.size).toBe(1);
        expect(
            new Set([...room.battleRoyaleTeams.keys(), ...room.arenaSpectators]),
        ).toEqual(new Set(room.players));
    });
    test("the websocket schema accepts only supported roster actions", () => {
        expect(
            zTeamClientMsg.safeParse({
                type: "rosterAction",
                data: { action: "shuffleTeams" },
            }).success,
        ).toBe(true);
        expect(
            zTeamClientMsg.safeParse({
                type: "rosterAction",
                data: { action: "spectateAll" },
            }).success,
        ).toBe(true);
        expect(
            zTeamClientMsg.safeParse({
                type: "rosterAction",
                data: { action: "kickAll" },
            }).success,
        ).toBe(false);
    });
});
