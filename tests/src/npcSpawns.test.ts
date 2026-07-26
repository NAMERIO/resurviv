import { expect, test } from "vitest";
import { DamageType, TeamMode } from "../../shared/gameConfig";
import { EditMsg } from "../../shared/net/editMsg";
import { KillMsg } from "../../shared/net/killMsg";
import { MsgStream } from "../../shared/net/net";
import { coldet } from "../../shared/utils/coldet";
import { createGame } from "./gameTestHelpers";

test("editor NPC spawn message preserves the NPC type", () => {
    const stream = new MsgStream(new ArrayBuffer(256));
    const sent = new EditMsg();
    sent.spawnNpcType = "motherShip";
    sent.serialize(stream.getStream());

    stream.stream.index = 0;
    const received = new EditMsg();
    received.deserialize(stream.getStream());

    expect(received.spawnNpcType).toBe("motherShip");
});

test("NPC death messages preserve the damage reason", () => {
    const stream = new MsgStream(new ArrayBuffer(256));
    const sent = new KillMsg();
    sent.damageType = DamageType.Npc;
    sent.mapSourceType = "skitter";
    sent.killed = true;
    sent.serialize(stream.getStream());

    stream.stream.index = 0;
    const received = new KillMsg();
    received.deserialize(stream.getStream());

    expect(received.damageType).toBe(DamageType.Npc);
    expect(received.mapSourceType).toBe("skitter");
    expect(received.killed).toBe(true);
});

test("map NPC counts create every configured NPC", async () => {
    const game = await createGame(TeamMode.Solo, "br_contact");
    const configuredCount = game.map.mapDef.gameMode.npcSpawns?.motherShip ?? 0;
    const motherShips = game.npcBarn.npcs.filter((npc) => npc.type === "motherShip");

    expect(motherShips).toHaveLength(configuredCount);
    expect(game.mapIndicatorBarn.mapIndicators).toHaveLength(configuredCount);
    for (let i = 0; i < motherShips.length; i++) {
        for (let j = i + 1; j < motherShips.length; j++) {
            expect(coldet.test(motherShips[i].collider, motherShips[j].collider)).toBe(
                false,
            );
        }
    }
});
