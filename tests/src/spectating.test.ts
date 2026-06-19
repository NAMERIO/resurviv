import { expect, test } from "vitest";
import { GameConfig, TeamMode } from "../../shared/gameConfig";
import { MsgType } from "../../shared/net/net";
import { v2 } from "../../shared/utils/v2";
import { createGame } from "./gameTestHelpers";

test("Spectator follows spectated player's killer without reopening scoreboard", async () => {
    const game = await createGame(TeamMode.Solo, "br_main");
    const spectator = game.playerBarn.addTestPlayer({ name: "Spectator" });
    const spectated = game.playerBarn.addTestPlayer({ name: "Spectated" });
    const killer = game.playerBarn.addTestPlayer({ name: "Killer" });
    game.playerBarn.addTestPlayer({ name: "Other" });

    spectator.kill({
        amount: 999,
        damageType: GameConfig.DamageType.Player,
        dir: v2.create(1, 0),
        source: spectated,
        gameSourceType: "m9",
    });
    game.step(0.1);

    spectator.spectating = spectated;
    spectator.msgsToSend.length = 0;

    spectated.kill({
        amount: 999,
        damageType: GameConfig.DamageType.Player,
        dir: v2.create(1, 0),
        source: killer,
        gameSourceType: "m9",
    });
    game.step(0.1);

    expect(spectator.spectating).toBe(killer);
    expect(spectator.msgsToSend.some((msg) => msg.type === MsgType.GameOver)).toBe(false);
});
