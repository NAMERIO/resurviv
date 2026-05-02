import { Main as BattleRoyaleMain } from "../../server/src/battleroyale/maps/maps/baseDefs";
import { Beach as BattleRoyaleBeach } from "../../server/src/battleroyale/maps/maps/beachDefs";
import { Birthday as BattleRoyaleBirthday } from "../../server/src/battleroyale/maps/maps/birthdayDefs";
import { Cobalt as BattleRoyaleCobalt } from "../../server/src/battleroyale/maps/maps/cobaltDefs";
import { Desert as BattleRoyaleDesert } from "../../server/src/battleroyale/maps/maps/desertDefs";
import { Faction as BattleRoyaleFaction } from "../../server/src/battleroyale/maps/maps/factionDefs";
import { Halloween as BattleRoyaleHalloween } from "../../server/src/battleroyale/maps/maps/halloweenDefs";
import { MainSpring as BattleRoyaleMainSpring } from "../../server/src/battleroyale/maps/maps/mainSpringDefs";
import { MainSummer as BattleRoyaleMainSummer } from "../../server/src/battleroyale/maps/maps/mainSummerDefs";
import { Potato as BattleRoyalePotato } from "../../server/src/battleroyale/maps/maps/potatoDefs";
import { PotatoSpring as BattleRoyalePotatoSpring } from "../../server/src/battleroyale/maps/maps/potatoSpringDefs";
import { Savannah as BattleRoyaleSavannah } from "../../server/src/battleroyale/maps/maps/savannahDefs";
import { Snow as BattleRoyaleSnow } from "../../server/src/battleroyale/maps/maps/snowDefs";
import { Turkey as BattleRoyaleTurkey } from "../../server/src/battleroyale/maps/maps/turkeyDefs";
import { Woods as BattleRoyaleWoods } from "../../server/src/battleroyale/maps/maps/woodsDefs";
import { WoodsSnow as BattleRoyaleWoodsSnow } from "../../server/src/battleroyale/maps/maps/woodsSnowDefs";
import { WoodsSpring as BattleRoyaleWoodsSpring } from "../../server/src/battleroyale/maps/maps/woodsSpringDefs";
import { WoodsSummer as BattleRoyaleWoodsSummer } from "../../server/src/battleroyale/maps/maps/woodsSummerDefs";
import { DeathmatchAprilFools } from "../../server/src/deathmatch/maps/aprilFools";
import { DeatchmatchCobalt } from "../../server/src/deathmatch/maps/cobalt";
import { DeatchmatchDesert } from "../../server/src/deathmatch/maps/desert";
import { FactionPotato } from "../../server/src/deathmatch/maps/faction_potato";
import { gun_game } from "../../server/src/deathmatch/maps/gun_game";
import { DeatchmatchHalloween } from "../../server/src/deathmatch/maps/halloween";
import { DeathmatchInferno } from "../../server/src/deathmatch/maps/inferno";
import { DeatchmatchMain } from "../../server/src/deathmatch/maps/main";
import { DeatchmatchPerks } from "../../server/src/deathmatch/maps/perks";
import { DeatchmatchSnow } from "../../server/src/deathmatch/maps/snow";
import { DeathmatchValentine } from "../../server/src/deathmatch/maps/valentine";
import { DeatchmatchWoods as Woods } from "../../server/src/deathmatch/maps/woods";
import type { Vec2 } from "../utils/v2";
import { Main } from "./maps/baseDefs";
import { Beach } from "./maps/beachDefs";
import { Birthday } from "./maps/birthdayDefs";
import { MainSpring } from "./maps/mainSpringDefs";
import { MainSummer } from "./maps/mainSummerDefs";
import { Potato } from "./maps/potatoDefs";
import { PotatoSpring } from "./maps/potatoSpringDefs";
import { Savannah } from "./maps/savannahDefs";
import { testFaction, testNormal } from "./maps/testDefs";
import { Turkey } from "./maps/turkeyDefs";
import { WoodsSnow } from "./maps/woodsSnowDefs";
import { WoodsSpring } from "./maps/woodsSpringDefs";
import { WoodsSummer } from "./maps/woodsSummerDefs";

export type Atlas =
    | "gradient"
    | "loadout"
    | "shared"
    | "main"
    | "desert"
    | "faction"
    | "april_fools"
    | "halloween"
    | "potato"
    | "snow"
    | "woods"
    | "cobalt"
    | "savannah"
    | "turkey"
    | "perks"
    | "valentine"
    | "inferno"
    | "beach";

export const MapDefs = {
    main: DeatchmatchMain,
    br_main: BattleRoyaleMain,
    main_spring: MainSpring,
    br_main_spring: BattleRoyaleMainSpring,
    main_summer: MainSummer,
    br_main_summer: BattleRoyaleMainSummer,
    desert: DeatchmatchDesert,
    br_desert: BattleRoyaleDesert,
    april_fools: DeathmatchAprilFools,
    faction: FactionPotato,
    br_faction: BattleRoyaleFaction,
    halloween: DeatchmatchHalloween,
    br_halloween: BattleRoyaleHalloween,
    gun_game: gun_game,
    potato: Potato,
    br_potato: BattleRoyalePotato,
    potato_spring: PotatoSpring,
    br_potato_spring: BattleRoyalePotatoSpring,
    snow: DeatchmatchSnow,
    br_snow: BattleRoyaleSnow,
    woods: Woods,
    br_woods: BattleRoyaleWoods,
    woods_snow: WoodsSnow,
    br_woods_snow: BattleRoyaleWoodsSnow,
    woods_spring: WoodsSpring,
    br_woods_spring: BattleRoyaleWoodsSpring,
    woods_summer: WoodsSummer,
    br_woods_summer: BattleRoyaleWoodsSummer,
    savannah: Savannah,
    br_savannah: BattleRoyaleSavannah,
    cobalt: DeatchmatchCobalt,
    br_cobalt: BattleRoyaleCobalt,
    turkey: Turkey,
    br_turkey: BattleRoyaleTurkey,
    birthday: Birthday,
    br_birthday: BattleRoyaleBirthday,
    perks: DeatchmatchPerks,
    valentine: DeathmatchValentine,
    inferno: DeathmatchInferno,
    beach: Beach,
    br_beach: BattleRoyaleBeach,

    /* STRIP_FROM_PROD_CLIENT:START */
    test_normal: testNormal,
    test_faction: testFaction,
    /* STRIP_FROM_PROD_CLIENT:END */
} satisfies Record<string, MapDef>;

export interface MapDef {
    mapId: number;
    desc: {
        name: string;
        icon: string;
        buttonCss: string;
        buttonText?: string;
        backgroundImg: string;
    };
    assets: {
        audio: Array<{
            name: string;
            channel: string;
        }>;
        atlases: Atlas[];
    };
    biome: {
        colors: {
            background: number;
            water: number;
            waterRipple: number;
            beach: number;
            riverbank: number;
            grass: number;
            underground: number;
            playerSubmerge: number;
            playerGhillie: number;
        };
        valueAdjust: number;
        sound: {
            riverShore: string;
        };
        particles: {
            camera: string;
        };
        tracerColors: Record<string, Record<string, number>>;
        airdrop: {
            planeImg: string;
            planeSound: string;
            airdropImg: string;
        };
        frozenSprites?: string[];
    };
    gameMode: {
        maxPlayers: number;
        killLeaderEnabled: boolean;
        aprilFoolsMode?: boolean;
        desertMode?: boolean;
        factionMode?: boolean;
        factions?: number;
        potatoMode?: boolean;
        woodsMode?: boolean;
        sniperMode?: boolean;
        perkMode?: boolean;
        perkModeRoles?: string[];
        allowLoadoutPerks?: boolean;
        turkeyMode?: boolean;
        spookyKillSounds?: boolean;
        infernoMode?: boolean;
    };
    gameConfig: {
        planes: {
            timings: Array<{
                circleIdx: number;
                wait: number;
                options: {
                    type: number;
                    numPlanes?: Array<{
                        count: number;
                        weight: number;
                    }>;
                    airstrikeZoneRad?: number;
                    wait?: number;
                    delay?: number;
                    airdropType?: string;
                };
            }>;
            crates: Array<{
                name: string;
                weight: number;
            }>;
        };
        roles?: {
            timings: Array<{
                role: string | (() => string);
                circleIdx: number;
                wait: number;
            }>;
        };
        unlocks?: {
            timings: Array<{
                type: string; // can either be a building with the door(s) to unlock OR the door itself, no support for structures yet
                stagger: number; // only for buildings with multiple unlocks, will stagger the unlocks instead of doing them all at once
                circleIdx: number;
                wait: number;
            }>;
        };
        bagSizes: Record<string, number[]>;
        bleedDamage: number;
        bleedDamageMult: number;
    };
    lootTable: Record<
        string,
        Array<{
            name: string;
            count: number;
            weight: number;
            preload?: boolean;
        }>
    >;
    mapGen: {
        map: {
            baseWidth: number;
            baseHeight: number;
            scale: {
                small: number;
                large: number;
            };
            extension: number;
            shoreInset: number;
            grassInset: number;
            rivers: {
                lakes: Array<{
                    odds: number;
                    innerRad: number;
                    outerRad: number;
                    circular?: boolean;
                    centerObj?: string;
                    spawnBound: {
                        pos: Vec2;
                        rad: number;
                    };
                }>;
                weights: Array<{
                    weight: number;
                    widths: number[];
                }>;
                smoothness: number;
                masks: Array<{
                    pos?: Vec2;
                    genOnShore?: boolean;
                    rad: number;
                }>;
                spawnCabins: boolean;
            };
        };
        places: Array<{
            name: string;
            pos: Vec2;
            dontSpawnObjects?: boolean;
        }>;
        bridgeTypes: {
            medium: string;
            large: string;
            xlarge: string;
        };
        customSpawnRules: {
            locationSpawns: Array<{
                type: string;
                pos: Vec2;
                rad: number;
                retryOnFailure: boolean;
            }>;
            placeSpawns: string[];
        };
        densitySpawns: [Record<string, number>];
        fixedSpawns: [
            Record<string, number | { odds: number } | { small: number; large: number }>,
        ];
        randomSpawns: Array<{
            spawns: string[];
            choose: number;
        }>;
        spawnReplacements: [Record<string, string>];
        importantSpawns: string[];
    };
}
