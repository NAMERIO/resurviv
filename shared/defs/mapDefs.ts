import { DeatchmatchCobalt } from "../../server/src/deathmatch/maps/cobalt";
import { DeatchmatchDesert } from "../../server/src/deathmatch/maps/desert";
import { gun_game } from "../../server/src/deathmatch/maps/gun_game";
import { DeatchmatchHalloween } from "../../server/src/deathmatch/maps/halloween";
import { DeatchmatchMain } from "../../server/src/deathmatch/maps/main";
import { DeatchmatchSnow } from "../../server/src/deathmatch/maps/snow";
import { DeatchmatchWoods as Woods } from "../../server/src/deathmatch/maps/woods";
import type { Vec2 } from "../utils/v2";
import { Faction } from "./maps/factionDefs";
import { MainSpring } from "./maps/mainSpringDefs";
import { MainSummer } from "./maps/mainSummerDefs";
import { May } from "./maps/mayDefs";
import { Potato } from "./maps/potatoDefs";
import { PotatoSpring } from "./maps/potatoSpringDefs";
import { Savannah } from "./maps/savannahDefs";
import { Turkey } from "./maps/turkeyDefs";
import { WoodsSnow } from "./maps/woodsSnowDefs";
import { WoodsSpring } from "./maps/woodsSpringDefs";
import { WoodsSummer } from "./maps/woodsSummerDefs";

export const MapDefs = {
    main: DeatchmatchMain,
    main_spring: MainSpring,
    main_summer: MainSummer,
    desert: DeatchmatchDesert,
    faction: Faction,
    halloween: DeatchmatchHalloween,
    gun_game: gun_game,
    potato: Potato,
    potato_spring: PotatoSpring,
    snow: DeatchmatchSnow,
    woods: Woods,
    woods_snow: WoodsSnow,
    woods_spring: WoodsSpring,
    woods_summer: WoodsSummer,
    savannah: Savannah,
    cobalt: DeatchmatchCobalt,
    turkey: Turkey,
    may: May,
} satisfies Record<string, MapDef>;

export type Atlas =
    | "gradient"
    | "loadout"
    | "shared"
    | "main"
    | "desert"
    | "faction"
    | "halloween"
    | "potato"
    | "snow"
    | "woods"
    | "cobalt"
    | "savannah"
    | "may";

export interface MapDef {
    mapId: number;
    desc: {
        name: string;
        icon: string;
        buttonCss: string;
        buttonText?: string;
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
        desertMode?: boolean;
        factionMode?: boolean;
        factions?: number;
        potatoMode?: boolean;
        woodsMode?: boolean;
        sniperMode?: boolean;
        perkMode?: boolean;
        perkModeRoles?: string[];
        turkeyMode?: number;
        spookyKillSounds?: boolean;
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
        unlocks?: {
            timings: Array<{
                type: string;
                stagger: number;
                circleIdx: number;
                wait: number;
            }>;
        };
        roles?: {
            timings: Array<{
                role: string | (() => string);
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
        densitySpawns: Array<Record<string, number>>;
        fixedSpawns: Array<
            Record<string, number | { odds: number } | { small: number; large: number }>
        >;
        randomSpawns: Array<{
            spawns: string[];
            choose: number;
        }>;
        spawnReplacements: Array<Record<string, string>>;
        importantSpawns: string[];
    };
}
