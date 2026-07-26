import { expect, test } from "vitest";
import { TeamMode } from "../../shared/gameConfig";
import { coldet } from "../../shared/utils/coldet";
import { createGame } from "./gameTestHelpers";

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
