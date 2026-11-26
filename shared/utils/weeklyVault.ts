import { GameObjectDefs } from "../defs/gameObjectDefs";
import { Rarity } from "../gameConfig";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MELEE_ROTATION_ANCHOR_MS = Date.UTC(2026, 10, 23);
const MELEE_REPEAT_COOLDOWN_WEEKS = 7;

export const WEEKLY_MELEE_STOCK = 7;
export const WEEKLY_WHEEL_MIN_LEVEL = 16;

const weeklyMeleePrices: Partial<Record<Rarity, number>> = {
    [Rarity.Rare]: 500,
    [Rarity.Epic]: 750,
    [Rarity.Mythic]: 1000,
};

const weeklyMeleePool: readonly string[] = [
    "huntsman_rugged",
    "huntsman_burnished",
    "bowie_vintage",
    "bowie_frontier",
    "karambit_camo",
    "bayonet_gilded",
    "knife_ben",
    "knife_toji",
    "karambit_blazing",
    "fliptechnical_rugged",
    "skeleton_knife_rugged",
    "m9bayonet_autotronic",
    "m9bayonet_pink",
    "m9bayonet_rugged",
    "dagger_kris",
    "ursus_jade",
    "karambit_amethyst",
    "karambit_gilded",
    "kunai_shadow",
    "sickle_farmer",
    "huntsman_bloodmoon",
    "karambit_bubblegum",
];

export const weeklyWheelPool: readonly string[] = [
    "outfitRosePetals",
    "outfitBengal",
    "outfitSortaBlue",
    "outfitPurpleMecha",
    "outfitItJustMist",
    "outfitOneInAMelon",
    "outfitBoet",
    "outfitFullCircle",
    "outfitPanteraOnca",
    "outfitOldKumo",
    "outfitPleasingPart",
    "outfitAvocadoh",
    "outfitTipTheScales",
    "outfitEyes_t",
    "outfitGhoulFire",
    "outfitSunburn",
    "outfitGridflag",
    "outfitStarflag",
    "outfitBubblegum",
    "outfitMelonWater",
    "outfitElectricIce",
    "outfitDragonTails",
    "outfitDigiturt",
    "outfitBraaains",
    "outfitNorseCode",
    "outfitStumped",
    "outfitCosmicBlue",
    "outfitChromaticCTR",
    "outfitTurtleSweater",
    "outfitHowPitaful",
    "outfitSoapPods",
    "outfitTomatoandCheese",
    "outfitH2Oh",
    "outfitSwords",
    "outfitHopelessRamentic",
    "outfitChewieCheese",
    "outfitWoodFire",
    "outfitHoldinHide",
    "outfitDisasteroid",
    "outfitRuppert",
    "outfitBluntRazor",
    "outfitGreenTeaRex",
    "outfitTribeMask",
    "outfitPhoebonachi",
    "outfitTribeShield",
    "outfitBrontoChop",
    "outfitTunelSun",
    "outfitHuedini",
    "outfitBombyman",
    "outfitIdDie4U",
    "outfitIntoTheGrid",
    "outfitBitplosion",
    "outfitMaxAttack",
    "outfitHowlODays",
    "outfitCaptnCactus",
    "outfitNachoHat",
    "outfitBroncoSaurus",
    "outfitNeckNapkin",
    "outfitMoosli",
    "outfitSuppaPoncho",
    "outfitGoodFeather",
    "outfitRanchDressing",
    "outfitTheySeeMeRolling",
    "outfitSirLoin",
    "outfitAhoy",
    "outfitLustrousPaladin",
    "outfitYinYang",
    "outfitTiki",
    "outfitMachoLucha2",
    "outfitCalaca",
    "outfitEggnite",
    "outfitSpaceSnout",
    "outfitMugnificent",
    "outfitDeRanged",
    "outfitSnow",
    "outfitBlackIce",
    "outfitCoconut",
    "outfitWave",
    "outfitParrotfish",
    "outfitCheckmate",
    "outfitWolf",
    "outfitRiotPlaid",
    "outfitBugcat",
    "outfitToxicFire",
    "outfitDonut",
    "outfitPolice",
    "outfitPreacher",
    "outfitPanda",
    "outfitDiamond",
    "outfitAero",
    "outfitColdestEdge",
    "outfitPeru",
    "outfitPaintSplat",
    "outfitSacredGeometry",
    "outfitGoldenWaffle",
    "outfitStoneIdol",
    "outfitMissingTexture",
    "outfitVikingHelm",
    "outfitBlush",
    "outfitMondrian",
    "outfitFishBowl",
    "outfitCatchemOl",
    "outfitPreyDinner",
    "outfitCandyCorn",
    "outfitVitaminD",
    "outfitSplotchfest",
    "outfitAstronaut",
    "outfitAmethystDisk",
    "outfitEventHorizon",
    "outfitStarryNight",
    "outfitBlueZone",
    "outfitKingGalaxy",
    "outfitILavaYou",
    "outfitStreetArt",
    "outfitColorPalette",
    "outfitScarween",
    "outfitMultiTusking",
    "outfitTirelessly",
    "outfitSunriseBlvd",
    "outfitToontooine",
    "outfitMecha",
    "outfitDiamondy",
    "outfitThePro",
    "outfitPsychadelia",
    "outfitLucky8",
    "outfitStainedGlass",
    "outfitGojo",
    "outfitChrollo",
    "outfitGon",
    "outfitMeruem",
    "outfitBlueEnforcer",
    "outfitJinglyJester",
    "outfitHachiware",
    "outfitOldArt",
    "outfitUnoReverse",
    "outfitYinyangTakeover",
    "outfitMahoraga",
    "outfitToxicChomper",
    "outfitCrimsonHibiscus",
    "outfitPtero",
    "outfitSpider",
    "outfitUnagi",
    "outfitReferee",
    "outfitFrankenMonster",
    "outfitBullyGear",
    "outfitGoldenPotatoDude",
    "outfitCavePaintings",
    "outfitLuna",
    "outfitTerra",
    "outfitNightshadeStalker",
    "outfitSpartan",
];

export type WeeklyMeleeOffer = {
    id: string;
    itemType: string;
    name: string;
    price: number;
    rarity: Rarity;
    totalStock: number;
    startsAt: number;
    refreshesAt: number;
};

export function getWeeklyRotation(now = Date.now()) {
    const date = new Date(now);
    const daysSinceMonday = (date.getUTCDay() + 6) % 7;
    const startsAt = Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate() - daysSinceMonday,
    );
    return {
        id: new Date(startsAt).toISOString().slice(0, 10),
        startsAt,
        endsAt: startsAt + WEEK_MS,
    };
}

function createSeededRandom(seed: number) {
    let state = seed >>> 0;
    return () => {
        state += 0x6d2b79f5;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

const meleeRotationHistory: string[] = [];

function getWeeklyMeleeItem(cycle: number) {
    for (let current = meleeRotationHistory.length; current <= cycle; current++) {
        const recent = new Set(
            meleeRotationHistory.slice(
                Math.max(0, current - MELEE_REPEAT_COOLDOWN_WEEKS),
                current,
            ),
        );
        const eligible = weeklyMeleePool.filter((item) => !recent.has(item));
        const random = createSeededRandom(current ^ 0x5f3759df);
        meleeRotationHistory.push(eligible[Math.floor(random() * eligible.length)]);
    }
    return meleeRotationHistory[cycle];
}

export function getWeeklyMeleeOffer(now = Date.now()): WeeklyMeleeOffer | null {
    const rotation = getWeeklyRotation(now);
    if (rotation.startsAt < MELEE_ROTATION_ANCHOR_MS) return null;

    const cycle = Math.round((rotation.startsAt - MELEE_ROTATION_ANCHOR_MS) / WEEK_MS);
    const itemType = getWeeklyMeleeItem(cycle);
    const def = GameObjectDefs[itemType];
    if (def?.type !== "melee" || def.rarity === undefined) {
        throw new Error(`Invalid weekly melee: ${itemType}`);
    }

    const rarity = def.rarity as Rarity;
    const price = weeklyMeleePrices[rarity];
    if (price === undefined) {
        throw new Error(`Unsupported weekly melee rarity: ${itemType}`);
    }

    return {
        id: `${rotation.id}-${itemType}`,
        itemType,
        name: def.name,
        price,
        rarity,
        totalStock: WEEKLY_MELEE_STOCK,
        startsAt: rotation.startsAt,
        refreshesAt: rotation.endsAt,
    };
}
