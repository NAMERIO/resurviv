import { expect, test } from "vitest";
import { GameConfig, TeamMode } from "../../shared/gameConfig";
import { v2 } from "../../shared/utils/v2";
import { createGame } from "./gameTestHelpers";

test("Battle royale switches to 1x when dropping equipped high scope", async () => {
    const game = await createGame(TeamMode.Solo, "br_main");
    const player = game.playerBarn.addTestPlayer({});

    expect(player.invManager.get("1xscope")).toBe(1);

    player.invManager.give("8xscope", 1);
    expect(player.scope).toBe("8xscope");

    player.dropInventoryItem("8xscope");

    expect(player.invManager.get("8xscope")).toBe(0);
    expect(player.scope).toBe("1xscope");
});

test("1x scope does not drop on death", async () => {
    const game = await createGame(TeamMode.Solo, "br_main");
    const player = game.playerBarn.addTestPlayer({});

    expect(player.invManager.get("1xscope")).toBe(1);

    player.kill({
        amount: 100,
        damageType: GameConfig.DamageType.Player,
        dir: v2.create(1, 0),
        source: player,
        gameSourceType: "m9",
    });

    expect(game.lootBarn.loots.some((loot) => loot.type === "1xscope")).toBe(false);
});
