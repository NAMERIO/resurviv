import { describe, expect, test, vi } from "vitest";
import { selectablePerks } from "../../shared/deathmatch/perks";
import { GameObjectDefs } from "../../shared/defs/gameObjectDefs";
import { DamageStreakDefs } from "../../shared/defs/gameObjects/damageStreakDefs";
import { RoleDefs } from "../../shared/defs/gameObjects/roleDefs";
import { MapObjectDefs } from "../../shared/defs/mapObjectDefs";
import { GameConfig, TeamMode } from "../../shared/gameConfig";
import { InputMsg } from "../../shared/net/inputMsg";
import { v2 } from "../../shared/utils/v2";
import { createGame } from "./gameTestHelpers";

async function setup(perk = "quick_reload") {
    const game = await createGame(TeamMode.Solo, "perks");
    const player = game.playerBarn.addTestPlayer({});
    player.roleSelect(perk);
    return { game, player };
}

function fire(game: Awaited<ReturnType<typeof createGame>>, player: any) {
    const spy = vi.spyOn(game.bulletBarn, "fireBullet");
    player.weaponManager.setWeapon(0, "m9", 15);
    player.weaponManager.setCurWeapIndex(0, true, true, true);
    player.weaponManager.fireWeapon(false);
    return spy.mock.calls.at(-1)![0];
}

function advanceStill(player: any, seconds: number) {
    for (let t = 0; t < seconds; t += 0.05) {
        player.posOld = v2.copy(player.pos);
        player.updateCamper(0.05);
    }
}

test("new perks are wired up", () => {
    expect(selectablePerks).toContain("camper");
    expect(selectablePerks).toContain("overpressure");
    expect(selectablePerks).not.toContain("heavy_duty");
    expect(RoleDefs.tank.perks).toContain("heavy_duty");
    expect(DamageStreakDefs.streak_specter.damageRequirement).toBe(400);
    expect(DamageStreakDefs.streak_vanish.damageRequirement).toBe(200);
    for (const type of ["camper", "overpressure", "heavy_duty"]) {
        expect(GameObjectDefs[type]).toBeDefined();
    }
});

describe("camper", () => {
    test("arms after 1 second still and needs 6 seconds after moving", async () => {
        const { player } = await setup("camper");
        advanceStill(player, 0.9);
        expect(player.camperActive).toBe(false);
        advanceStill(player, 0.2);
        expect(player.camperActive).toBe(true);

        player.posOld = v2.sub(player.pos, v2.create(1, 0));
        player.updateCamper(0.05);
        expect(player.camperActive).toBe(false);

        advanceStill(player, 5.85);
        expect(player.camperActive).toBe(false);
        advanceStill(player, 0.3);
        expect(player.camperActive).toBe(true);
    });

    test("boosts bullets only while armed", async () => {
        const { game, player } = await setup("camper");
        expect(fire(game, player).speedMult).toBeCloseTo(1);
        player.camperActive = true;
        const shot = fire(game, player);
        expect(shot.speedMult).toBeCloseTo(1.5);
        expect(shot.damageMult).toBeCloseTo(1.12);
    });
});

test("overpressure boosts damage, speed and range", async () => {
    const { game, player } = await setup("overpressure");
    const shot = fire(game, player);
    expect(shot.damageMult).toBeCloseTo(1.1);
    expect(shot.speedMult).toBeCloseTo(1.1);
    expect(shot.distanceMult).toBeCloseTo(1.1);
});

test("heavy duty speeds bullets and thickens tracers", async () => {
    const { game, player } = await setup();
    player.addPerk("heavy_duty", false);
    const shot = fire(game, player);
    expect(shot.speedMult).toBeCloseTo(1.2);
    expect(shot.trailThick).toBe(true);
});

test("specter uses its own damage requirement and walks through obstacles", async () => {
    const { game, player } = await setup();
    player.chosenStreakType = "streak_specter";
    player.damageDealt = 399;
    player.checkDamageStreaks();
    expect(player.streakReady).toBe(false);
    player.damageDealt = 400;
    player.checkDamageStreaks();
    player.activateStreak();
    expect(player.hasPerk("streak_specter_effect")).toBe(true);

    const pos = v2.create(100, 100);
    game.map.genObstacle("crate_01", pos, player.layer, 0, 1);
    player.pos = v2.copy(pos);
    game.grid.updateObject(player);
    player.doAction("bandage", GameConfig.Action.UseItem, 3);
    player.update(0.016);

    expect(v2.distance(player.pos, pos)).toBeLessThan(0.01);
    expect(player.actionType).toBe(GameConfig.Action.None);

    player.deactivateStreak();
    player.update(0.016);
    expect(v2.distance(player.pos, pos)).toBeGreaterThan(0.01);
});

describe("specter phasing", () => {
    async function walkInto(type: string) {
        const { game, player } = await setup();
        game.map.genObstacle(type, v2.create(300, 300), 0, 0, 1);
        player.pos = v2.create(292, 300);
        player.layer = 0;
        game.grid.updateObject(player);
        player.chosenStreakType = "streak_specter";
        player.damageDealt = 400;
        player.checkDamageStreaks();
        player.activateStreak();
        const input = new InputMsg();
        input.moveRight = true;
        player.handleInput(input);
        for (let i = 0; i < 60; i++) player.update(1 / 30);
        return player.pos.x;
    }

    test.each(["crate_01", "stone_01", "tree_01"])("passes through %s", async (type) => {
        expect(await walkInto(type)).toBeGreaterThan(305);
    });

    test.each([
        "hut_wall_int_4",
        "brick_wall_ext_10",
        "glass_wall_10",
    ])("is blocked by %s", async (type) => {
        expect(await walkInto(type)).toBeLessThan(300);
    });

    test("every wall, door and window stays solid", async () => {
        const { game, player } = await setup();
        for (const [type, def] of Object.entries(MapObjectDefs) as [string, any][]) {
            if (def.type !== "obstacle") continue;
            if (!def.isWall && !def.isWindow && !def.door && !/glass_wall/.test(type)) {
                continue;
            }
            const obstacle = game.map.genObstacle(type, v2.create(500, 500), 0, 0, 1);
            expect(player.specterCanPhase(obstacle), type).toBe(false);
        }
    });
});

test("vanish hides from enemies and shooting ends it into a cooldown", async () => {
    const { game, player } = await setup();
    const enemy = game.playerBarn.addTestPlayer({});
    enemy.roleSelect("quick_reload");
    const smokeSpy = vi.spyOn(game.smokeBarn, "addEmitter");

    player.chosenStreakType = "streak_vanish";
    player.damageDealt = 200;
    player.checkDamageStreaks();
    player.activateStreak();

    expect(smokeSpy).toHaveBeenCalledOnce();
    expect(player.isInvisibleTo(enemy)).toBe(true);
    expect(player.isInvisibleTo(player)).toBe(false);

    fire(game, player);
    expect(player.streakActive).toBe(false);
    expect(player.isInvisibleTo(enemy)).toBe(false);

    player.damageDealt = 1000;
    player.checkDamageStreaks();
    expect(player.streakReady).toBe(false);
    player.updateStreaks(5.1);
    expect(player.streakReady).toBe(true);
});
