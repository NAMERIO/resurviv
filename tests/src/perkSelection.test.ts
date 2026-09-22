import { expect, test, vi } from "vitest";
import { ConfigManager } from "../../client/src/config";
import { getSelectedPerk, selectablePerks } from "../../shared/deathmatch/perks";
import { GameConfig, TeamMode } from "../../shared/gameConfig";
import { InputMsg } from "../../shared/net/inputMsg";
import { BitStream } from "../../shared/net/net";
import {
    ObjectSerializeFns,
    type ObjectsFullData,
    ObjectType,
} from "../../shared/net/objectSerializeFns";
import { collider } from "../../shared/utils/collider";
import { v2 } from "../../shared/utils/v2";
import { createGame } from "./gameTestHelpers";

test("Perks mode waits for confirmation and blocks combat during selection", async () => {
    const game = await createGame(TeamMode.Solo, "perks");
    const player = game.playerBarn.addTestPlayer({});
    expect(player.perkSelectionPending).toBe(true);
    expect(player.perks.some((perk) => selectablePerks.includes(perk.type))).toBe(false);

    const input = new InputMsg();
    input.moveRight = true;
    input.shootHold = true;
    player.handleInput(input);
    expect(player.moveRight).toBe(false);
    expect(player.shootHold).toBe(false);

    const health = player.health;
    player.damage({
        amount: 25,
        damageType: GameConfig.DamageType.Airdrop,
        dir: v2.create(1, 0),
    });
    expect(player.health).toBe(health);

    player.roleSelect("armor_master");
    expect(player.perkSelectionPending).toBe(false);
    expect(player.hasPerk("armor_master")).toBe(true);
    expect(player.loadout.perk).toBe("armor_master");
    player.handleInput(input);
    expect(player.moveRight).toBe(true);
    player.damage({
        amount: 25,
        damageType: GameConfig.DamageType.Airdrop,
        dir: v2.create(1, 0),
    });
    expect(player.health).toBeLessThan(health);
});

test("Perk selection rejects invalid perks and cannot be changed after confirmation", async () => {
    const game = await createGame(TeamMode.Solo, "perks");
    const player = game.playerBarn.addTestPlayer({});
    for (const invalid of ["", "invalid", "tank", "streak_juggernaut_effect"]) {
        player.roleSelect(invalid);
        expect(player.perkSelectionPending).toBe(true);
    }
    player.roleSelect("quick_reload");
    player.roleSelect("gun_master");
    expect(player.hasPerk("quick_reload")).toBe(true);
    expect(player.hasPerk("gun_master")).toBe(false);
});

test("Server timeout enters with the remembered perk even without client confirmation", async () => {
    const game = await createGame(TeamMode.Solo, "perks");
    const player = game.playerBarn.addTestPlayer({});
    player.loadout.perk = "melee_runner";
    player.update(GameConfig.player.perkSelectDuration - 1);
    expect(player.perkSelectionPending).toBe(true);
    player.update(player.perkMenuTicker + 0.1);
    expect(player.perkSelectionPending).toBe(false);
    expect(player.hasPerk("melee_runner")).toBe(true);
});

test("Other modes reject perk selection and Cobalt still selects a class", async () => {
    const normal = await createGame(TeamMode.Solo, "test_normal");
    const normalPlayer = normal.playerBarn.addTestPlayer({});
    normalPlayer.roleSelect("gun_master");
    expect(normalPlayer.perkSelectionPending).toBe(false);
    expect(normalPlayer.hasPerk("gun_master")).toBe(false);

    const cobalt = await createGame(TeamMode.Solo, "cobalt");
    const cobaltPlayer = cobalt.playerBarn.addTestPlayer({});
    expect(cobaltPlayer.perkSelectionPending).toBe(false);
    const role = cobalt.map.mapDef.gameMode.perkModeRoles![0];
    cobaltPlayer.roleSelect(role);
    expect(cobaltPlayer.role).toBe(role);
});

test("Saved perks are validated with a safe default for first-time or stale choices", () => {
    expect(getSelectedPerk("gun_master")).toBe("gun_master");
    expect(getSelectedPerk(undefined)).toBe("quick_reload");
    expect(getSelectedPerk("removed_perk")).toBe("quick_reload");
});

test("The selected perk survives a config reload without replacing the Cobalt class", () => {
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
    });
    try {
        const firstVisit = new ConfigManager();
        firstVisit.load(() => {});
        firstVisit.set("perkModeRole", "tank");
        firstVisit.set("perkModePerk", "gun_master");

        const nextVisit = new ConfigManager();
        nextVisit.load(() => {});
        expect(nextVisit.get("perkModePerk")).toBe("gun_master");
        expect(nextVisit.get("perkModeRole")).toBe("tank");
    } finally {
        vi.unstubAllGlobals();
    }
});

test("Waiting players have no world hitbox and spawn at confirmation", async () => {
    const game = await createGame(TeamMode.Duo, "perks");
    const group = game.playerBarn.addGroup(false);
    const player = game.playerBarn.addTestPlayer({ group });
    const viewer = game.playerBarn.addTestPlayer({ group });
    const spawn = v2.create(60, 60);
    const chooseSpawn = vi.spyOn(game.playerBarn, "getSpawnPos").mockReturnValue(spawn);
    const nearby = () =>
        game.grid.intersectCollider(collider.createCircle(player.pos, 3));

    expect(nearby()).not.toContain(player);
    expect(player.isInvisibleTo(viewer)).toBe(true);
    expect(player.isInvisibleTo(player)).toBe(true);
    expect(viewer.getPlayerStatus().some((status) => status.visible)).toBe(false);
    player.roleSelect("invalid");
    expect(chooseSpawn).not.toHaveBeenCalled();
    expect(nearby()).not.toContain(player);

    player.roleSelect("quick_reload");
    expect(chooseSpawn).toHaveBeenCalledOnce();
    expect(player.pos).toEqual(spawn);
    expect(group.spawnPosition).toEqual(spawn);
    expect(nearby()).toContain(player);
    expect(player.isInvisibleTo(viewer)).toBe(false);
    player.roleSelect("armor_master");
    expect(chooseSpawn).toHaveBeenCalledOnce();
});

test("Spawn visibility round-trips over the network and on timeout", async () => {
    const game = await createGame(TeamMode.Solo, "perks");
    const player = game.playerBarn.addTestPlayer({});
    const serializer = ObjectSerializeFns[ObjectType.Player];
    const readState = () => {
        const stream = new BitStream(new ArrayBuffer(1024));
        serializer.serializeFull(stream, player);
        stream.index = 0;
        const data = {} as ObjectsFullData[ObjectType.Player];
        serializer.deserializeFull(stream, data);
        return data;
    };
    expect(readState().perkSelectionPending).toBe(true);
    expect(player.__gridCells).toHaveLength(0);
    player.update(player.perkMenuTicker + 0.1);
    expect(readState().perkSelectionPending).toBe(false);
    expect(player.__gridCells.length).toBeGreaterThan(0);
});

test("Disconnecting before selection leaves no body or loot in the world", async () => {
    const game = await createGame(TeamMode.Solo, "perks");
    const player = game.playerBarn.addTestPlayer({});
    const bodyCount = game.deadBodyBarn.deadBodies.length;
    const lootCount = game.lootBarn.loots.length;
    game.playerBarn.socketIdToPlayer.set(player.socketId, player);
    game.handleSocketClose(player.socketId);
    expect(player.dead).toBe(true);
    expect(player.__gridCells).toHaveLength(0);
    expect(game.deadBodyBarn.deadBodies).toHaveLength(bodyCount);
    expect(game.lootBarn.loots).toHaveLength(lootCount);
});
