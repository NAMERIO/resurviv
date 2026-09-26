import type { MapDef } from "../mapDefs";

// Return fresh arrays so each map can own its loot tiers.
export function createDeathmatchLootTiers(): Pick<
    MapDef["lootTable"],
    "tier_soviet" | "tier_world"
> {
    return {
        tier_soviet: [
            { name: "mine", count: 1, weight: 1 },
            { name: "mirv", count: 1, weight: 1 },
            { name: "poison_gas", count: 1, weight: 0.5 },
            { name: "smoke", count: 1, weight: 0.5 },
            { name: "bonesaw_rusted", count: 1, weight: 0.05 },
            { name: "fireaxe", count: 1, weight: 0.05 },
            { name: "kukri_trad", count: 1, weight: 0.1 },
            { name: "katana_rusted", count: 1, weight: 0.05 },
            { name: "machete", count: 1, weight: 0.1 },
            { name: "sv98", count: 1, weight: 0.025 },
            { name: "saiga", count: 1, weight: 0.025 },
            { name: "strobe", count: 1, weight: 0.025 },
            { name: "flare", count: 1, weight: 0.025 },
            { name: "m249", count: 1, weight: 0.013 },
            { name: "pkp", count: 1, weight: 0.013 },
            { name: "healthkit", count: 1, weight: 0.25 },
            { name: "painkiller", count: 1, weight: 0.25 },
            { name: "frag", count: 3, weight: 0.25 },
            { name: "tier_world", count: 2, weight: 0.775 },
        ],
        tier_world: [
            { name: "frag", count: 1, weight: 2.5 },
            { name: "smoke", count: 1, weight: 0.5 },
            { name: "bandage", count: 2, weight: 1.5 },
            { name: "healthkit", count: 1, weight: 0.25 },
            { name: "soda", count: 1, weight: 0.25 },
            { name: "painkiller", count: 1, weight: 0.25 },
            { name: "crowbar", count: 1, weight: 0.25 },
            { name: "spade", count: 1, weight: 0.25 },
            { name: "smoke", count: 10, weight: 0.1 },
            { name: "frag", count: 10, weight: 0.1 },
            { name: "tier_soviet", count: 1, weight: 0.3 },
            { name: "", count: 1, weight: 6.25 },
        ],
    };
}
