import { describe, expect, test } from "vitest";
import { GameObjectDefs } from "../../shared/defs/gameObjectDefs";
import type { MeleeDef } from "../../shared/defs/gameObjects/meleeDefs";
import { GameConfig, TeamMode } from "../../shared/gameConfig";
import { InputMsg } from "../../shared/net/inputMsg";
import { BitStream } from "../../shared/net/net";
import {
    ObjectSerializeFns,
    type ObjectsFullData,
    ObjectType,
} from "../../shared/net/objectSerializeFns";
import { v2 } from "../../shared/utils/v2";
import { createGame } from "./gameTestHelpers";

const web = (GameObjectDefs.web_shooter as MeleeDef).webShooter!;

async function setup(obstacleType?: string, obstacleX = 310) {
    const game = await createGame(TeamMode.Solo, "main");
    const player = game.playerBarn.addTestPlayer({});
    for (const obstacle of game.map.obstacles) obstacle.collidable = false;
    if (obstacleType) {
        game.map.genObstacle(obstacleType, v2.create(obstacleX, 300), 0, 0, 1);
    }
    player.pos = v2.create(292, 300);
    player.layer = 0;
    game.grid.updateObject(player);
    player.weaponManager.setWeapon(GameConfig.WeaponSlot.Melee, "web_shooter", 0);
    player.weaponManager.setCurWeapIndex(GameConfig.WeaponSlot.Melee, true, true, true);
    tick(player, 0.5);
    return { game, player };
}

function tick(player: any, seconds: number, shoot = false) {
    const input = new InputMsg();
    input.toMouseDir = v2.create(1, 0);
    input.toMouseLen = 10;
    input.shootStart = shoot;
    input.shootHold = shoot;
    player.handleInput(input);
    for (let t = 0; t < seconds; t += 1 / 30) {
        player.layer = 0;
        player.update(1 / 30);
        if (shoot) {
            player.handleInput(
                Object.assign(new InputMsg(), { toMouseDir: v2.create(1, 0) }),
            );
            shoot = false;
        }
    }
}

describe("web shooter", () => {
    test("is airdrop loot with web gloves", () => {
        const def = GameObjectDefs.web_shooter as MeleeDef;
        expect(def.type).toBe("melee");
        expect(def.handSprites?.spriteR).toBe("player-fists-web-r.img");
    });

    test("pulls the player up to the obstacle the web hits", async () => {
        const { player } = await setup("stone_01");
        tick(player, 1 / 30, true);
        expect(player.webAnchor).not.toBeNull();
        tick(player, 1);
        expect(player.pos.x).toBeGreaterThan(304);
        expect(player.pos.x).toBeLessThan(310);
        expect(player.webAnchor).toBeNull();
    });

    test("still shoots with dev Punch Fast on", async () => {
        const { player } = await setup("stone_01");
        player.debug.punchFast = true;
        tick(player, 1 / 30, true);
        expect(player.webAnchor).not.toBeNull();
        tick(player, 1);
        expect(player.pos.x).toBeGreaterThan(304);
    });

    test("does not pull through walls", async () => {
        const { player } = await setup("brick_wall_ext_10", 300);
        tick(player, 1 / 30, true);
        tick(player, 1);
        expect(player.pos.x).toBeGreaterThan(295);
        expect(player.pos.x).toBeLessThan(300);
    });

    test("a miss shows the web but does not move the player", async () => {
        const { player } = await setup();
        tick(player, 1 / 30, true);
        expect(player.webAnchor).not.toBeNull();
        tick(player, 1);
        expect(player.pos.x).toBeCloseTo(292, 0);
        expect(player.webAnchor).toBeNull();
    });

    test("obstacles out of range are ignored", async () => {
        const { player } = await setup("stone_01", 292 + web.range + 3);
        tick(player, 1 / 30, true);
        tick(player, 1);
        expect(player.pos.x).toBeCloseTo(292, 0);
    });

    test("has a cooldown between webs", async () => {
        const { game, player } = await setup("stone_01");
        const reset = () => {
            player.pos = v2.create(292, 300);
            game.grid.updateObject(player);
        };
        tick(player, 1 / 30, true);
        tick(player, 0.5);
        expect(player.pos.x).toBeGreaterThan(304);
        reset();
        tick(player, 1 / 30, true);
        tick(player, 1);
        expect(player.pos.x).toBeCloseTo(292, 0);

        tick(player, web.cooldown);
        reset();
        tick(player, 1 / 30, true);
        tick(player, 1);
        expect(player.pos.x).toBeGreaterThan(304);
    });

    test("has no pull-out delay", async () => {
        const { player } = await setup("stone_01");
        player.weaponManager.setCurWeapIndex(GameConfig.WeaponSlot.Primary, true, true);
        player.weaponManager.setCurWeapIndex(GameConfig.WeaponSlot.Melee, true, true);
        expect(
            player.weaponManager.weapons[GameConfig.WeaponSlot.Melee].cooldown,
        ).toBeLessThanOrEqual(0);
        tick(player, 1 / 30, true);
        expect(player.webAnchor).not.toBeNull();
    });

    test("reports the web recharge time for the HUD", async () => {
        const { player } = await setup("stone_01");
        expect(player.webCooldownTime).toBe(0);
        tick(player, 1 / 30, true);
        expect(player.webCooldownTime).toBeGreaterThan(web.cooldown - 0.1);
        tick(player, web.cooldown);
        expect(player.webCooldownTime).toBe(0);
    });

    test("anchor is synced to clients", async () => {
        const { player } = await setup("stone_01");
        const read = () => {
            const stream = new BitStream(new ArrayBuffer(1024));
            ObjectSerializeFns[ObjectType.Player].serializeFull(stream, player);
            stream.index = 0;
            const data = {} as ObjectsFullData[ObjectType.Player];
            ObjectSerializeFns[ObjectType.Player].deserializeFull(stream, data);
            return data.webAnchor;
        };
        expect(read()).toBeNull();
        tick(player, 1 / 30, true);
        const anchor = read();
        expect(anchor).not.toBeNull();
        expect(anchor!.x).toBeGreaterThan(306);
        expect(anchor!.x).toBeLessThan(310);
    });
});
