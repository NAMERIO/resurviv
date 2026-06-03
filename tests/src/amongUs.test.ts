import { expect, test } from "vitest";
import { GameConfig, TeamMode } from "../../shared/gameConfig";
import { MsgType } from "../../shared/net/net";
import { v2 } from "../../shared/utils/v2";
import { createGame } from "./gameTestHelpers";

async function createAmongUsPlayers(crewCount: number) {
    const game = await createGame(TeamMode.Ten, "among_us");
    const group = game.playerBarn.addGroup(false);
    const impostor = game.playerBarn.addTestPlayer({ group, name: "Impostor" });
    impostor.amongUsRole = "impostor";

    const crewmates = Array.from({ length: crewCount }, (_, idx) => {
        const player = game.playerBarn.addTestPlayer({
            group,
            name: `Crewmate ${idx + 1}`,
        });
        player.amongUsRole = "crewmate";
        return player;
    });

    game.started = true;
    game.playerBarn.amongUsRolesAssigned = true;
    return { game, impostor, crewmates };
}

test("Among Us impostor does not win while more than one crewmate remains", async () => {
    const { game, impostor, crewmates } = await createAmongUsPlayers(3);

    crewmates[2].kill({
        amount: 999,
        damageType: GameConfig.DamageType.Player,
        dir: v2.create(1, 0),
        source: impostor,
        gameSourceType: "karambit",
    });

    expect(game.over).toBe(false);
});

test("Among Us impostor win counts unassigned survivors as crew", async () => {
    const { game, impostor, crewmates } = await createAmongUsPlayers(2);
    const lateCrew = game.playerBarn.addTestPlayer({
        group: impostor.group,
        name: "Late Crew",
    });
    lateCrew.amongUsRole = "";

    crewmates[1].kill({
        amount: 999,
        damageType: GameConfig.DamageType.Player,
        dir: v2.create(1, 0),
        source: impostor,
        gameSourceType: "karambit",
    });

    expect(game.over).toBe(false);
});

test("Among Us late joiners become crewmates after roles are assigned", async () => {
    const { game, impostor } = await createAmongUsPlayers(2);

    const lateCrew = game.playerBarn.addTestPlayer({
        group: impostor.group,
        name: "Late Crew",
    });

    expect(lateCrew.amongUsRole).toBe("crewmate");
});

test("Among Us impostors can see each other's roles", async () => {
    const { game, impostor, crewmates } = await createAmongUsPlayers(2);
    const secondImpostor = game.playerBarn.addTestPlayer({
        group: impostor.group,
        name: "Impostor 2",
    });
    secondImpostor.amongUsRole = "impostor";

    expect(secondImpostor.getPlayerInfoFor(impostor).amongUsRole).toBe("impostor");
    expect(impostor.getPlayerInfoFor(secondImpostor).amongUsRole).toBe("impostor");
    expect(impostor.getPlayerInfoFor(crewmates[0]).amongUsRole).toBe("");
    expect(crewmates[0].getPlayerInfoFor(impostor).amongUsRole).toBe("");
});

test("Among Us impostors cannot karambit kill other impostors", async () => {
    const { game, impostor } = await createAmongUsPlayers(2);
    const secondImpostor = game.playerBarn.addTestPlayer({
        group: impostor.group,
        name: "Impostor 2",
    });
    secondImpostor.amongUsRole = "impostor";

    secondImpostor.damage({
        amount: 1000,
        damageType: GameConfig.DamageType.Player,
        dir: v2.create(1, 0),
        source: impostor,
        gameSourceType: "karambit",
    });

    expect(secondImpostor.dead).toBe(false);
    expect(secondImpostor.health).toBe(GameConfig.player.health);
});

test("Among Us impostor win only marks impostors as winners", async () => {
    const { game, impostor, crewmates } = await createAmongUsPlayers(2);

    crewmates[1].kill({
        amount: 999,
        damageType: GameConfig.DamageType.Player,
        dir: v2.create(1, 0),
        source: impostor,
        gameSourceType: "karambit",
    });

    const impostorGameOver = impostor.msgsToSend.find(
        (msg) => msg.type === MsgType.GameOver,
    )?.msg;
    const crewmateGameOver = crewmates[0].msgsToSend.find(
        (msg) => msg.type === MsgType.GameOver,
    )?.msg;

    expect(game.over).toBe(true);
    expect(impostorGameOver).toMatchObject({
        gameOver: true,
        winningTeamId: impostor.teamId,
        teamRank: 1,
    });
    expect(crewmateGameOver).toMatchObject({
        gameOver: true,
        winningTeamId: 0,
        teamRank: 2,
    });
});

test("Among Us crewmate win only marks crewmates as winners", async () => {
    const { game, impostor, crewmates } = await createAmongUsPlayers(2);

    impostor.kill({
        amount: 999,
        damageType: GameConfig.DamageType.Player,
        dir: v2.create(1, 0),
        gameSourceType: "explosion_among_us_eject",
    });

    const impostorGameOver = impostor.msgsToSend.find(
        (msg) => msg.type === MsgType.GameOver,
    )?.msg;
    const crewmateGameOver = crewmates[0].msgsToSend.find(
        (msg) => msg.type === MsgType.GameOver,
    )?.msg;

    expect(game.over).toBe(true);
    expect(impostorGameOver).toMatchObject({
        gameOver: true,
        winningTeamId: 0,
        teamRank: 2,
    });
    expect(crewmateGameOver).toMatchObject({
        gameOver: true,
        winningTeamId: crewmates[0].teamId,
        teamRank: 1,
    });
});

test("Among Us assigns the configured impostor count", async () => {
    const game = await createGame(TeamMode.Ten, "among_us");
    game.amongUsImpostorCount = 3;
    const group = game.playerBarn.addGroup(false);

    for (let i = 0; i < 7; i++) {
        game.playerBarn.addTestPlayer({
            group,
            name: `Player ${i + 1}`,
        });
    }

    game.playerBarn.assignAmongUsRoles();

    expect(
        game.playerBarn.players.filter((player) => player.amongUsRole === "impostor"),
    ).toHaveLength(3);
});

test("Among Us impostors win when living crew equals living impostors", async () => {
    const game = await createGame(TeamMode.Ten, "among_us");
    const group = game.playerBarn.addGroup(false);
    const impostors = Array.from({ length: 2 }, (_, idx) => {
        const player = game.playerBarn.addTestPlayer({
            group,
            name: `Impostor ${idx + 1}`,
        });
        player.amongUsRole = "impostor";
        return player;
    });
    const crewmates = Array.from({ length: 3 }, (_, idx) => {
        const player = game.playerBarn.addTestPlayer({
            group,
            name: `Crewmate ${idx + 1}`,
        });
        player.amongUsRole = "crewmate";
        return player;
    });

    game.started = true;
    game.playerBarn.amongUsRolesAssigned = true;
    crewmates[2].kill({
        amount: 999,
        damageType: GameConfig.DamageType.Player,
        dir: v2.create(1, 0),
        source: impostors[0],
        gameSourceType: "karambit",
    });

    expect(game.over).toBe(true);
});
