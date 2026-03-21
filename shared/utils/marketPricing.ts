import { GameObjectDefs } from "../defs/gameObjectDefs";
import { Rarity } from "../gameConfig";

const supportedMarketTypes = new Set([
    "outfit",
    "melee",
    "emote",
    "heal_effect",
    "boost_effect",
    "death_effect",
]);

export const marketMinPriceByRarity: Record<Rarity, number> = {
    [Rarity.Stock]: 300,
    [Rarity.Common]: 300,
    [Rarity.Uncommon]: 300,
    [Rarity.Rare]: 750,
    [Rarity.Epic]: 750,
    [Rarity.Mythic]: 3000,
};

export const marketMaxSellPrice = 10000;

export function getMarketItemRarity(itemType: string) {
    const def = GameObjectDefs[itemType] as { type?: string; rarity?: Rarity } | undefined;
    if (!def || !def.type || !supportedMarketTypes.has(def.type)) return null;
    const rarity = def.rarity ?? Rarity.Stock;
    if (rarity < Rarity.Rare) return null;
    return rarity;
}

export function getMarketPriceBounds(itemType: string) {
    const rarity = getMarketItemRarity(itemType);
    if (rarity === null) return null;

    return {
        rarity,
        min: marketMinPriceByRarity[rarity],
        max: marketMaxSellPrice,
    };
}

export function getSuggestedMarketSellPrice(itemType: string) {
    const bounds = getMarketPriceBounds(itemType);
    if (!bounds) return null;
    return bounds.min;
}

export function isValidMarketSellPrice(itemType: string, price: number) {
    const bounds = getMarketPriceBounds(itemType);
    if (!bounds || !Number.isInteger(price)) return false;
    return price >= bounds.min && price <= bounds.max;
}
