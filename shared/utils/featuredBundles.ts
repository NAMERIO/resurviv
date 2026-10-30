import { GameObjectDefs } from "../defs/gameObjectDefs";
import { PassDefs } from "../defs/gameObjects/passDefs";
import {
    type FeaturedBundleDef,
    FeaturedBundleDefs,
    type FeaturedBundleSize,
} from "../defs/gameObjects/featuredBundleDefs";
import { Rarity } from "../gameConfig";
import { getMarketItemRarity } from "./marketPricing";

export type { FeaturedBundleSize } from "../defs/gameObjects/featuredBundleDefs";

export type FeaturedBundleRarity =
    | "uncommon"
    | "rare"
    | "epic"
    | "legendary"
    | "mythic"
    | "divine"
    | "exclusive";

export type FeaturedBundleOffer = {
    id: string;
    name: string;
    size: FeaturedBundleSize;
    page: number;
    itemTypes: string[];

    // Price before the weekly discount.
    originalPrice: number;

    // Actual price the player pays.
    price: number;

    // 0, 10, 15, 20, or 25.
    discountPercent: number;

    rarity: FeaturedBundleRarity;
    refreshesAt: number;
    purchased: boolean;
};

const FEATURED_BUNDLE_ANCHOR_MS = Date.UTC(
    2026,
    0,
    1,
    0,
    0,
    0,
    0,
);

const DAY_MS = 24 * 60 * 60 * 1000;
const RANDOM_BUNDLE_DURATION_DAYS = 7;

/*
 * Possible weekly discounts.
 *
 * Each of the six bundle slots rolls one of these.
 * Because the roll is seeded by the weekly cycle,
 * everyone sees the same discount for that slot.
 */
const FEATURED_BUNDLE_DISCOUNTS = [
    0,
    10,
    15,
    20,
    25,
] as const;

/*
 * These outfits can NEVER appear in generated bundles.
 */
const RANDOM_BUNDLE_EXCLUDED_OUTFITS = new Set([
    // Staff / private / special
    "outfitReTag",
    "outfitDev",
    "outfitMod",
    "outfitGD",
    "outfitOwnr",
    "outfitShinyGold",
    "outfitTheSurvivor",
    "outfitStepz",
    "outfitLifeTroll",
    "outfitLifeTroll2",
    "outfitLivingGalaxy",

    // Ranked / season rewards
    "outfitTopOnePercent",
    "outfitTopTwoPercent",
    "outfitTopThreePercent",
    "outfitSzn2",
    "outfitSzn3",

    // Props
    "outfitBarrel",
    "outfitWoodBarrel",
    "outfitStone",
    "outfitTree",
    "outfitHalloweenTree",
    "outfitStump",
    "outfitBush",
    "outfitLeafPile",
    "outfitCrate",
    "outfitTable",
    "outfitSoviet",
    "outfitOven",
    "outfitRefrigerator",
    "outfitVending",
    "outfitPumpkin",
    "outfitWoodpile",
    "outfitToilet",
    "outfitBushRiver",
    "outfitCrab",
    "outfitStumpAxe",

    // Other excluded
    "outfitFishInABarrel",
]);

/*
 * Automatically excludes outfit rewards
 * from EVERY Battle Pass.
 *
 * This also automatically handles future passes
 * added to PassDefs.
 */
const BATTLE_PASS_OUTFITS = new Set(
    Object.values(PassDefs)
        .flatMap((pass) => [
            ...pass.items,
            ...(pass.premiumItems ?? []),
        ])
        .flatMap((reward) =>
            "item" in reward ? [reward.item] : [],
        )
        .filter((itemType) => {
            const itemDef = GameObjectDefs[itemType] as
                | { type?: string }
                | undefined;

            return itemDef?.type === "outfit";
        }),
);

export const bundleMinPrice: Record<Rarity, number> = {
    [Rarity.Stock]: 100,
    [Rarity.Common]: 100,
    [Rarity.Uncommon]: 100,
    [Rarity.Rare]: 500,
    [Rarity.Epic]: 500,
    [Rarity.Mythic]: 1500,
};

type BundleWindow = {
    cycle: number;
    startsAt: number;
    refreshesAt: number;
};

type BundleDefinitionWithId = FeaturedBundleDef & {
    id: string;
};

function getBundleWindow(
    durationDays: number,
    now = Date.now(),
    resetAt?: number,
): BundleWindow {
    if (
        !Number.isFinite(durationDays) ||
        durationDays <= 0
    ) {
        throw new Error(
            "Featured bundle durationDays must be greater than zero",
        );
    }

    const durationMs = durationDays * DAY_MS;

    if (
        resetAt !== undefined &&
        Number.isFinite(resetAt) &&
        resetAt <= now &&
        now < resetAt + durationMs
    ) {
        const cycle = Math.max(
            0,
            Math.floor(
                (resetAt - FEATURED_BUNDLE_ANCHOR_MS) /
                    durationMs,
            ),
        );

        return {
            cycle,
            startsAt: resetAt,
            refreshesAt: resetAt + durationMs,
        };
    }

    const cycle = Math.max(
        0,
        Math.floor(
            (now - FEATURED_BUNDLE_ANCHOR_MS) /
                durationMs,
        ),
    );

    const startsAt =
        FEATURED_BUNDLE_ANCHOR_MS +
        cycle * durationMs;

    return {
        cycle,
        startsAt,
        refreshesAt: startsAt + durationMs,
    };
}

function createSeededRandom(seed: number) {
    let state = seed >>> 0;

    return () => {
        state += 0x6d2b79f5;

        let value = state;

        value = Math.imul(
            value ^ (value >>> 15),
            value | 1,
        );

        value ^=
            value +
            Math.imul(
                value ^ (value >>> 7),
                value | 61,
            );

        return (
            ((value ^ (value >>> 14)) >>> 0) /
            4294967296
        );
    };
}

function shuffleWithRandom<T>(
    items: readonly T[],
    random: () => number,
) {
    const shuffled = [...items];

    for (
        let i = shuffled.length - 1;
        i > 0;
        i--
    ) {
        const j = Math.floor(
            random() * (i + 1),
        );

        [shuffled[i], shuffled[j]] = [
            shuffled[j],
            shuffled[i],
        ];
    }

    return shuffled;
}

function getBundleBasePrice(itemType: string) {
    const rarity = getMarketItemRarity(itemType);

    if (rarity === null) {
        return null;
    }

    return bundleMinPrice[rarity];
}

function getGeneratedBundlePrice(
    items: string[],
) {
    return Math.max(
        1,
        items.reduce(
            (total, itemType) => {
                return (
                    total +
                    (getBundleBasePrice(
                        itemType,
                    ) ?? 0)
                );
            },
            0,
        ),
    );
}

export function getBundleMinPrice(
    itemType: string,
) {
    return getBundleBasePrice(itemType);
}

export function getFeaturedBundleRarity(
    price: number,
): FeaturedBundleRarity {
    if (price < 1200) return "uncommon";
    if (price < 1600) return "rare";
    if (price < 2000) return "epic";
    if (price < 2500) return "legendary";
    if (price < 3200) return "mythic";
    if (price < 4100) return "divine";

    return "exclusive";
}

/*
 * Generates a deterministic discount for
 * one specific weekly bundle slot.
 *
 * The slot is determined by:
 * - weekly cycle
 * - page
 * - small/large
 *
 * That means:
 * - refreshing cannot reroll it
 * - every player gets the same discount
 * - every slot can have a different discount
 */
function getFeaturedBundleDiscount(
    cycle: number,
    page: number,
    size: FeaturedBundleSize,
) {
    const sizeSeed =
        size === "small"
            ? 0x13572468
            : 0x24681357;

    const seed =
        cycle ^
        Math.imul(
            page + 1,
            0x45d9f3b,
        ) ^
        sizeSeed;

    const random =
        createSeededRandom(seed);

    const index = Math.floor(
        random() *
            FEATURED_BUNDLE_DISCOUNTS.length,
    );

    return FEATURED_BUNDLE_DISCOUNTS[
        index
    ]!;
}

function buildBundleOffer(
    definition: BundleDefinitionWithId,
    window: BundleWindow,
    page: number,
): FeaturedBundleOffer {
    const itemTypes = [
        ...new Set(definition.items),
    ];

    for (const itemType of itemTypes) {
        const itemDef =
            GameObjectDefs[itemType];

        if (!itemDef) {
            throw new Error(
                `Featured bundle ${definition.id} contains unknown item ${itemType}`,
            );
        }
    }

    /*
     * Keep the bundle's normal price.
     */
    const originalPrice = Math.max(
        1,
        Math.round(definition.price),
    );

    /*
     * Roll this slot's weekly discount.
     */
    const discountPercent =
        getFeaturedBundleDiscount(
            window.cycle,
            page,
            definition.size,
        );

    /*
     * Calculate the ACTUAL price charged.
     *
     * Example:
     * 2000 GP with 20% OFF
     * = 1600 GP.
     */
    const price = Math.max(
        1,
        Math.round(
            originalPrice *
                (1 -
                    discountPercent /
                        100),
        ),
    );

    return {
        id: `${window.cycle}-${definition.id}`,
        name: definition.name,
        size: definition.size,
        page,
        itemTypes,

        originalPrice,
        price,
        discountPercent,

        /*
         * Bundle rarity/color is based on
         * the ORIGINAL value.
         *
         * A discount should not downgrade
         * the visual rarity of the bundle.
         */
        rarity:
            getFeaturedBundleRarity(
                originalPrice,
            ),

        refreshesAt:
            window.refreshesAt,

        purchased: false,
    };
}

function getPremadeBundlePool(
    size: FeaturedBundleSize,
): BundleDefinitionWithId[] {
    return Object.entries(
        FeaturedBundleDefs,
    )
        .filter(
            ([, definition]) => {
                return (
                    definition.size ===
                    size
                );
            },
        )
        .map(
            ([id, definition]) => ({
                id,
                ...definition,
            }),
        )
        .sort((a, b) =>
            a.id.localeCompare(b.id),
        );
}

function selectPremadeBundle(
    size: FeaturedBundleSize,
    cycle: number,
): BundleDefinitionWithId {
    const pool =
        getPremadeBundlePool(size);

    if (pool.length === 0) {
        throw new Error(
            `No ${size} featured bundle definitions are available`,
        );
    }

    const seed =
        size === "small"
            ? cycle ^ 0x13579bdf
            : cycle ^ 0x2468ace0;

    const random =
        createSeededRandom(seed);

    return pool[
        Math.floor(
            random() * pool.length,
        )
    ];
}

function getOutfitsFromBundle(
    bundle: BundleDefinitionWithId,
) {
    return bundle.items.filter(
        (itemType) => {
            const itemDef =
                GameObjectDefs[
                    itemType
                ] as
                    | {
                          type?: string;
                      }
                    | undefined;

            return (
                itemDef?.type ===
                "outfit"
            );
        },
    );
}

function getRandomBundleOutfitPool(
    excludedOutfits: ReadonlySet<string>,
) {
    return Object.entries(
        GameObjectDefs,
    )
        .filter(
            ([itemType, itemDef]) => {
                const def =
                    itemDef as {
                        type?: string;
                    };

                return (
                    def.type ===
                        "outfit" &&
                    getMarketItemRarity(
                        itemType,
                    ) !== null &&
                    !RANDOM_BUNDLE_EXCLUDED_OUTFITS.has(
                        itemType,
                    ) &&
                    !BATTLE_PASS_OUTFITS.has(
                        itemType,
                    ) &&
                    !excludedOutfits.has(
                        itemType,
                    )
                );
            },
        )
        .map(
            ([itemType]) =>
                itemType,
        )
        .sort();
}

function createGeneratedBundle(
    id: string,
    name: string,
    size: FeaturedBundleSize,
    items: string[],
): BundleDefinitionWithId {
    return {
        id,
        name,
        size,
        items,

        price:
            getGeneratedBundlePrice(
                items,
            ),

        durationDays:
            RANDOM_BUNDLE_DURATION_DAYS,
    };
}

export function getFeaturedBundleSource(
    bundleId: string,
) {
    return `featured_bundle:${bundleId}`;
}

export function getFeaturedBundleOffers(
    now = Date.now(),
    resetAt?: number,
) {
    /*
     * All six bundle slots share
     * the exact same seven-day rotation.
     */
    const window = getBundleWindow(
        RANDOM_BUNDLE_DURATION_DAYS,
        now,
        resetAt,
    );

    /*
     * =========================
     * PAGE 1
     * =========================
     *
     * One random premade small bundle.
     * One random premade large bundle.
     *
     * Same choices for everyone
     * during this weekly cycle.
     */

    const pageOneSmall =
        selectPremadeBundle(
            "small",
            window.cycle,
        );

    const pageOneLarge =
        selectPremadeBundle(
            "large",
            window.cycle,
        );

    /*
     * Any outfits used by Page 1
     * cannot appear in generated
     * Pages 2 or 3.
     */
    const pageOneOutfits =
        new Set([
            ...getOutfitsFromBundle(
                pageOneSmall,
            ),

            ...getOutfitsFromBundle(
                pageOneLarge,
            ),
        ]);

    /*
     * =========================
     * PAGES 2 + 3
     * =========================
     *
     * Automatically generated
     * outfit-only bundles.
     *
     * SMALL:
     * ALWAYS exactly 2 outfits.
     *
     * LARGE:
     * Randomly 3 or 4 outfits.
     *
     * The pool is shuffled once
     * and consumed in order.
     *
     * Therefore no generated outfit
     * can appear twice during the
     * same weekly rotation.
     */

    const generatedRandom =
        createSeededRandom(
            window.cycle ^
                0x5f3759df,
        );

    const outfitPool =
        shuffleWithRandom(
            getRandomBundleOutfitPool(
                pageOneOutfits,
            ),
            generatedRandom,
        );

    /*
     * Small bundles:
     * ALWAYS exactly 2.
     */
    const pageTwoSmallCount = 2;
    const pageThreeSmallCount = 2;

    /*
     * Large bundles:
     * randomly 3 or 4.
     */
    const pageTwoLargeCount =
        3 +
        Math.floor(
            generatedRandom() * 2,
        );

    const pageThreeLargeCount =
        3 +
        Math.floor(
            generatedRandom() * 2,
        );

    const totalGeneratedOutfits =
        pageTwoSmallCount +
        pageTwoLargeCount +
        pageThreeSmallCount +
        pageThreeLargeCount;

    if (
        outfitPool.length <
        totalGeneratedOutfits
    ) {
        throw new Error(
            `Not enough eligible outfits for generated featured bundles. Need ${totalGeneratedOutfits}, found ${outfitPool.length}.`,
        );
    }

    let poolIndex = 0;

    const takeOutfits = (
        count: number,
    ) => {
        const items =
            outfitPool.slice(
                poolIndex,
                poolIndex + count,
            );

        poolIndex += count;

        return items;
    };

    /*
     * PAGE 2
     */

    const pageTwoSmall =
        createGeneratedBundle(
            "generated-page-2-small",
            "Random Mini",
            "small",
            takeOutfits(
                pageTwoSmallCount,
            ),
        );

    const pageTwoLarge =
        createGeneratedBundle(
            "generated-page-2-large",
            "Random Large",
            "large",
            takeOutfits(
                pageTwoLargeCount,
            ),
        );

    /*
     * PAGE 3
     */

    const pageThreeSmall =
        createGeneratedBundle(
            "generated-page-3-small",
            "Random Mini",
            "small",
            takeOutfits(
                pageThreeSmallCount,
            ),
        );

    const pageThreeLarge =
        createGeneratedBundle(
            "generated-page-3-large",
            "Random Large",
            "large",
            takeOutfits(
                pageThreeLargeCount,
            ),
        );

    /*
     * Build all six offers.
     *
     * buildBundleOffer() also applies
     * each slot's deterministic
     * weekly discount.
     */

    const offers = [
        // =====================
        // PAGE 1
        // =====================

        buildBundleOffer(
            pageOneSmall,
            window,
            0,
        ),

        buildBundleOffer(
            pageOneLarge,
            window,
            0,
        ),

        // =====================
        // PAGE 2
        // =====================

        buildBundleOffer(
            pageTwoSmall,
            window,
            1,
        ),

        buildBundleOffer(
            pageTwoLarge,
            window,
            1,
        ),

        // =====================
        // PAGE 3
        // =====================

        buildBundleOffer(
            pageThreeSmall,
            window,
            2,
        ),

        buildBundleOffer(
            pageThreeLarge,
            window,
            2,
        ),
    ];

    return {
        window,
        offers,
    };
}