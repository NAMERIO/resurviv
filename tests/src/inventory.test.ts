import { expect, test } from "vitest";
import { TeamMode } from "../../shared/gameConfig";
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
