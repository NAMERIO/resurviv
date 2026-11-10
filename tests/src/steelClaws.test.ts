import { describe, expect, test } from "vitest";
import { GameObjectDefs } from "../../shared/defs/gameObjectDefs";
import type { MeleeDef } from "../../shared/defs/gameObjects/meleeDefs";
import { GameConfig, TeamMode } from "../../shared/gameConfig";
import { InputMsg } from "../../shared/net/inputMsg";
import { v2 } from "../../shared/utils/v2";
import { createGame } from "./gameTestHelpers";

const def = GameObjectDefs.steel_claws as MeleeDef;

async function setup() {
    const game = await createGame(TeamMode.Solo, "main");
    const player = game.playerBarn.addTestPlayer({});
    for (const obstacle of game.map.obstacles) obstacle.collidable = false;
    player.pos = v2.create(292, 300);
    player.layer = 0;
    game.grid.updateObject(player);
    player.weaponManager.setWeapon(GameConfig.WeaponSlot.Melee, "steel_claws", 0);
    player.weaponManager.setCurWeapIndex(GameConfig.WeaponSlot.Melee, true, true, true);
    tick(player, 0.5);
    return { game, player };
}

function tick(player: any, seconds: number, shoot = false, mouseLen = 10) {
    const input = new InputMsg();
    input.toMouseDir = v2.create(1, 0);
    input.toMouseLen = mouseLen;
    input.shootStart = shoot;
    input.shootHold = shoot;
    player.handleInput(input);
    for (let t = 0; t < seconds; t += 1 / 30) {
        player.layer = 0;
        player.update(1 / 30);
        if (shoot) {
            player.handleInput(
                Object.assign(new InputMsg(), {
                    toMouseDir: v2.create(1, 0),
                    toMouseLen: mouseLen,
                }),
            );
            shoot = false;
        }
    }
}

describe("steel claws", () => {
    test("is a melee item with claw hands", () => {
        expect(def.type).toBe("melee");
        expect(def.switchDelay).toBe(0);
        expect(def.handSprites?.spriteR).toBe("player-fists-steel-claws.img");
    });

    test("each swing lunges toward the cursor, up to the max distance", async () => {
        const { player } = await setup();
        tick(player, 1 / 30, true, 30);
        tick(player, 0.5, false, 30);
        expect(player.pos.x).toBeCloseTo(292 + def.clawDash!.distance, 0);
    });

    test("a close cursor makes a short lunge", async () => {
        const { player } = await setup();
        tick(player, 1 / 30, true, 4);
        tick(player, 0.5);
        expect(player.pos.x).toBeCloseTo(292 + 4 - def.attack.offset.x, 0);
    });

    function addEnemy(game: any, x: number) {
        const enemy = game.playerBarn.addTestPlayer({});
        enemy.pos = v2.create(x, 300);
        enemy.layer = 0;
        enemy.helmet = "";
        enemy.chest = "";
        game.grid.updateObject(enemy);
        return enemy;
    }

    test("hurts the moment the dash starts", async () => {
        const { game, player } = await setup();
        const enemy = addEnemy(game, 295);
        const before = enemy.health;
        tick(player, 1 / 30, true);
        expect(before - enemy.health).toBeCloseTo(def.damage, 0);
    });

    test("hits an enemy it reaches mid-dash", async () => {
        const { game, player } = await setup();
        const enemy = addEnemy(game, 300.5);
        const before = enemy.health;
        tick(player, 1 / 30, true);
        expect(enemy.health).toBe(before);
        tick(player, def.clawDash!.duration);
        expect(before - enemy.health).toBeCloseTo(def.damage, 0);
    });

    test("hits each enemy only once per swing", async () => {
        const { game, player } = await setup();
        const enemy = addEnemy(game, 295);
        const before = enemy.health;
        tick(player, 1 / 30, true);
        tick(player, def.attack.cooldownTime);
        expect(before - enemy.health).toBeCloseTo(def.damage, 0);
    });
});
