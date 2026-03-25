import { GameObjectDefs } from "../defs/gameObjectDefs";
import { type LootBoxDef, lootBoxDefs } from "../defs/gameObjects/lootBoxDefs";
import type { Rarity } from "../gameConfig";

export const lootBoxes: Record<string, LootBoxDef> = lootBoxDefs;

export function getLootBox(boxId: string) {
    return lootBoxes[boxId];
}

export function getLootBoxItems(boxId: string) {
    const box = getLootBox(boxId);
    if (!box) return [];
    return Object.values(box.itemPools).flatMap((items) => items || []);
}

export function pickLootBoxReward(
    boxId: string,
    random = Math.random,
): { itemType: string; rarity: Rarity } | null {
    const box = getLootBox(boxId);
    if (!box) return null;

    const availableChances = box.chances.filter((entry) => {
        const items = box.itemPools[entry.rarity];
        return Array.isArray(items) && items.length > 0;
    });
    if (availableChances.length === 0) return null;

    const totalWeight = availableChances.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = random() * totalWeight;
    let selectedRarity = availableChances[availableChances.length - 1]!.rarity;
    for (const chance of availableChances) {
        roll -= chance.weight;
        if (roll <= 0) {
            selectedRarity = chance.rarity;
            break;
        }
    }

    const pool = box.itemPools[selectedRarity] || [];
    if (pool.length === 0) return null;
    const itemType = pool[Math.floor(random() * pool.length)]!;
    const itemDef = GameObjectDefs[itemType] as { rarity?: Rarity } | undefined;
    return {
        itemType,
        rarity: itemDef?.rarity ?? selectedRarity,
    };
}
