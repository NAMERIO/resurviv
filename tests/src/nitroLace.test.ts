import { expect, test } from "vitest";
import { GameConfig, TeamMode } from "../../shared/gameConfig";
import { InputMsg } from "../../shared/net/inputMsg";
import { createGame } from "./gameTestHelpers";

test("Nitro Lace cannot be used outside Inferno mode", async () => {
    const game = await createGame(TeamMode.Solo, "test_normal");
    const player = game.playerBarn.addTestPlayer({});
    player.invManager.set("nitroLace", 1);

    const msg = new InputMsg();
    msg.useItem = "nitroLace";
    player.handleInput(msg);

    expect(player.actionType).toBe(GameConfig.Action.None);
});

test("Nitro Lace can be used in Inferno mode", async () => {
    const game = await createGame(TeamMode.Solo, "inferno");
    const player = game.playerBarn.addTestPlayer({});
    player.invManager.set("nitroLace", 1);

    const msg = new InputMsg();
    msg.useItem = "nitroLace";
    player.handleInput(msg);

    expect(player.actionType).toBe(GameConfig.Action.UseItem);
    expect(player.actionItem).toBe("nitroLace");
});
