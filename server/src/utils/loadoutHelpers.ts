import crypto from "node:crypto";
import { GameObjectDefs } from "../../../shared/defs/gameObjectDefs";
import type { GunDef } from "../../../shared/defs/gameObjects/gunDefs";
import { UnlockDefs } from "../../../shared/defs/gameObjects/unlockDefs";
import { GameConfig } from "../../../shared/gameConfig";
import type { JoinMsg } from "../../../shared/net/joinMsg";
import type { Loadout } from "../../../shared/utils/loadout";
import { Config } from "../config";
import type { Player } from "../game/objects/player";
import { defaultLogger } from "./logger";

const loadoutSecret = Config.secrets.SURVEV_LOADOUT_SECRET;

// source: https://gist.github.com/vlucas/2bd40f62d20c1d49237a109d491974eb
// but changed it from hex to base64 since it uses less characters

export function encryptLoadout(loadout: Loadout) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
        "aes-256-cbc",
        Buffer.from(loadoutSecret, "base64"),
        iv,
    );
    const encrypted = Buffer.concat([
        cipher.update(JSON.stringify(loadout), "utf8"),
        cipher.final(),
    ]);
    return `${iv.toString("base64")}:${encrypted.toString("base64")}`;
}

function decryptLoadout(encodedLoadout: string): Loadout | undefined {
    if (!encodedLoadout) return undefined;
    try {
        const [ivString, encryptedString] = encodedLoadout.split(":");

        if (!ivString || !encryptedString) {
            defaultLogger.warn("Invalid or corrupted cipher format");
            return;
        }

        const encryptedText = Buffer.from(encryptedString, "base64");
        const decipher = crypto.createDecipheriv(
            "aes-256-cbc",
            Buffer.from(loadoutSecret, "base64"),
            Buffer.from(ivString, "base64"),
        );

        const decrypted = Buffer.concat([
            decipher.update(encryptedText),
            decipher.final(),
        ]);

        return JSON.parse(decrypted.toString());
    } catch (err) {
        defaultLogger.error("Failed to decrypt loadout:", err);
    }
}

export function setLoadout(joinMsg: JoinMsg, player: Player) {
    const decryptedLoadout = decryptLoadout(joinMsg.loadoutPriv);
    const processedLoadout = decryptedLoadout ? decryptedLoadout : joinMsg.loadout;

    const defaultItems = player.game.playerBarn.defaultItems;

    /**
     * Checks if an item is present in the player's loadout
     */
    const isItemInLoadout = (item: string, category: string) => {
        //
        // if (!UnlockDefs.unlock_default.unlocks.includes(item)) return false;

        const def = GameObjectDefs[item];
        if (!def || def.type !== category) return false;

        return true;
    };

    if (
        isItemInLoadout(joinMsg.loadout.outfit, "outfit") &&
        joinMsg.loadout.outfit !== "outfitBase"
    ) {
        player.setOutfit(joinMsg.loadout.outfit);
    } else {
        player.setOutfit(defaultItems.outfit);
    }

    if (
        isItemInLoadout(joinMsg.loadout.melee, "melee") &&
        joinMsg.loadout.melee != "fists"
    ) {
        player.weapons[GameConfig.WeaponSlot.Melee].type = joinMsg.loadout.melee;
    }

    const loadout = player.loadout;

    if (isItemInLoadout(joinMsg.loadout.heal, "heal")) {
        loadout.heal = joinMsg.loadout.heal;
    }
    if (isItemInLoadout(joinMsg.loadout.boost, "boost")) {
        loadout.boost = joinMsg.loadout.boost;
    }

    const emotes = joinMsg.loadout.emotes;
    for (let i = 0; i < emotes.length; i++) {
        const emote = emotes[i];
        if (i > GameConfig.EmoteSlot.Count) break;

        if (emote === "" || !isItemInLoadout(emote, "emote")) {
            continue;
        }

        loadout.emotes[i] = emote;
    }

    // Normal mode: Initialize primary weapon
    if (isItemInLoadout(joinMsg.loadout.primary, "gun")) {
        const slot = GameConfig.WeaponSlot.Primary;
        player.weapons[slot].type = joinMsg.loadout.primary;
        const gunDef = GameObjectDefs[player.weapons[slot].type] as GunDef;
        player.weapons[slot].ammo = gunDef.maxClip;
    }

    // Normal mode: Initialize secondary weapon
    if (isItemInLoadout(joinMsg.loadout.secondary, "gun")) {
        const slot = GameConfig.WeaponSlot.Secondary;
        player.weapons[slot].type = joinMsg.loadout.secondary;

        // Disable dual spas in normal mode
        if (
            player.weapons[GameConfig.WeaponSlot.Primary].type === "spas12" &&
            player.weapons[slot].type === "spas12"
        ) {
            player.weapons[slot].type = "mosin";
        }

        const gunDef = GameObjectDefs[player.weapons[slot].type] as GunDef;
        player.weapons[slot].ammo = gunDef.maxClip;
    }

    // Add "inspiration" perk if using "bugle"
    if (
        player.weapons[GameConfig.WeaponSlot.Primary].type == "bugle" ||
        player.weapons[GameConfig.WeaponSlot.Secondary].type == "bugle"
    ) {
        player.addPerk("inspiration", false);
    }

    return;

    /**
     * Checks if an item is present in the player's loadout
     */
    const _isItemInLoadout = (item: string, category: string) => {
        if (!decryptedLoadout && !UnlockDefs.unlock_default.unlocks.includes(item))
            return false;

        const def = GameObjectDefs[item];
        if (!def || def.type !== category) return false;

        return true;
    };

    if (
        isItemInLoadout(processedLoadout.outfit, "outfit") &&
        processedLoadout.outfit !== "outfitBase"
    ) {
        player.setOutfit(processedLoadout.outfit);
    } else {
        player.setOutfit(defaultItems.outfit);
    }

    if (
        isItemInLoadout(processedLoadout.melee, "melee") &&
        processedLoadout.melee != "fists"
    ) {
        player.weapons[GameConfig.WeaponSlot.Melee].type = processedLoadout.melee;
    }

    if (isItemInLoadout(processedLoadout.heal, "heal_effect")) {
        player.loadout.heal = processedLoadout.heal;
    }
    if (isItemInLoadout(processedLoadout.boost, "boost_effect")) {
        player.loadout.boost = processedLoadout.boost;
    }

    const _emotes = processedLoadout.emotes;
    for (let i = 0; i < emotes.length; i++) {
        const emote = emotes[i];
        if (i > GameConfig.EmoteSlot.Count) break;

        if (emote === "" || !isItemInLoadout(emote, "emote")) {
            continue;
        }

        player.loadout.emotes[i] = emote;
    }
}
