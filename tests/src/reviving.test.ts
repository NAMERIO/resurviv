import { expect, test } from "vitest";
import { GameConfig, TeamMode } from "../../shared/gameConfig";
import { InputMsg } from "../../shared/net/inputMsg";
import { v2 } from "../../shared/utils/v2";
import { createGame } from "./gameTestHelpers";

const reviveDur = GameConfig.player.reviveDuration + 0.1;

test("Battle royale teammate revive", async () => {
    const game = await createGame(TeamMode.Squad, "br_main");

    const group = game.playerBarn.addGroup(false);
    const playerA = game.playerBarn.addTestPlayer({ group });
    const playerB = game.playerBarn.addTestPlayer({ group });

    playerB.damage({
        amount: 999,
        damageType: GameConfig.DamageType.Airdrop,
        dir: v2.randomUnit(),
    });
    expect(playerB.downed).toBeTruthy();
    expect(playerB.dead).toBeFalsy();

    const msg = new InputMsg();
    msg.addInput(GameConfig.Input.Interact);
    playerA.handleInput(msg);
    expect(playerA.playerBeingRevived).toBe(playerB);

    game.step(reviveDur);

    expect(playerB.downed).toBeFalsy();
    expect(playerB.dead).toBeFalsy();
});

test("Battle royale downed player bleeds out", async () => {
    const game = await createGame(TeamMode.Squad, "br_main");

    const group = game.playerBarn.addGroup(false);
    game.playerBarn.addTestPlayer({ group });
    const playerB = game.playerBarn.addTestPlayer({ group });

    playerB.damage({
        amount: 999,
        damageType: GameConfig.DamageType.Airdrop,
        dir: v2.randomUnit(),
    });
    expect(playerB.downed).toBeTruthy();

    game.step(60);

    expect(playerB.downed).toBeFalsy();
    expect(playerB.dead).toBeTruthy();
});

test("Battle royale kills squad when all teammates are downed", async () => {
    const game = await createGame(TeamMode.Squad, "br_main");

    const group = game.playerBarn.addGroup(false);
    const playerA = game.playerBarn.addTestPlayer({ group });
    const playerB = game.playerBarn.addTestPlayer({ group });
    const playerC = game.playerBarn.addTestPlayer({ group });

    playerA.damage({
        amount: 999,
        damageType: GameConfig.DamageType.Airdrop,
        dir: v2.randomUnit(),
    });
    expect(playerA.downed).toBeTruthy();

    playerB.damage({
        amount: 999,
        damageType: GameConfig.DamageType.Airdrop,
        dir: v2.randomUnit(),
    });
    expect(playerB.downed).toBeTruthy();

    playerC.damage({
        amount: 999,
        damageType: GameConfig.DamageType.Airdrop,
        dir: v2.randomUnit(),
    });

    expect(playerA.dead).toBeTruthy();
    expect(playerB.dead).toBeTruthy();
    expect(playerC.dead).toBeTruthy();
});

test("Deathmatch team mode still has revives disabled", async () => {
    const game = await createGame(TeamMode.Squad, "test_normal");

    const group = game.playerBarn.addGroup(false);
    game.playerBarn.addTestPlayer({ group });
    const playerB = game.playerBarn.addTestPlayer({ group });

    playerB.damage({
        amount: 999,
        damageType: GameConfig.DamageType.Airdrop,
        dir: v2.randomUnit(),
    });

    expect(playerB.downed).toBeFalsy();
    expect(playerB.dead).toBeTruthy();
});
