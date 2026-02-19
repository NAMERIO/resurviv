import { Rarity } from "../../gameConfig";
import { type DeepPartial, util } from "../../utils/util";
import type { Vec2 } from "../../utils/v2";

export interface MeleeDef {
    readonly type: "melee";
    name: string;
    quality: number;
    autoAttack: boolean;
    switchDelay: number;
    damage: number;
    obstacleDamage: number;
    cleave?: boolean;
    attack: {
        offset: Vec2;
        rad: number;
        damageTimes: number[];
        cooldownTime: number;
    };
    speed: {
        equip: number;
        attack?: number;
    };
    anim: {
        idlePose: string;
        attackAnims: string[];
        poseAnims?: string[];
    };
    sound: Record<string, string>;
    //  {
    //     swing: string
    //     deploy: string
    //     playerHit: string
    //     playerHit2?: string
    //     pickup?: string
    //     bullet?: string
    // }
    lootImg: {
        sprite: string;
        scale: number;
        rad?: number;
        tint: number;
        border?: string;
        borderTint?: number;
        rot?: number;
        mirror?: boolean;
    };
    baseType?: string;
    rarity?: number;
    lore?: string;
    noPotatoSwap?: boolean;
    noDropOnDeath?: boolean;
    worldImg?: Img;
    hipImg?: Img;
    reflectSurface?: {
        equipped: {
            p0: Vec2;
            p1: Vec2;
        };
        unequipped: {
            p0: Vec2;
            p1: Vec2;
        };
    };
    armorPiercing?: boolean;
    stonePiercing?: boolean;
    reflectArea?: {
        offset: Vec2;
        rad: number;
    };
    handSprites?: {
        spriteL: string;
        spriteR: string;
    };
    scale?: {
        x: number;
        y: number;
    };
}

export interface Img {
    sprite: string;
    pos: Vec2;
    rot: number;
    scale: Vec2;
    tint: number;
    leftHandOntop?: boolean;
    renderOnHand?: boolean;
}

function defineMeleeSkin(baseType: string, params: DeepPartial<MeleeDef>): MeleeDef {
    return util.mergeDeep({}, BaseDefs[baseType], params);
}

const BaseDefs: Record<string, MeleeDef> = {
    fists: {
        name: "Fists",
        type: "melee",
        quality: 0,
        autoAttack: false,
        switchDelay: 0.25,
        damage: 24,
        obstacleDamage: 1,
        attack: {
            offset: {
                x: 1.35,
                y: 0,
            },
            rad: 0.9,
            damageTimes: [0.1],
            cooldownTime: 0.25,
        },
        speed: {
            equip: 1,
        },
        anim: {
            idlePose: "fists",
            attackAnims: ["fists"],
        },
        sound: {
            swing: "punch_swing_01",
            deploy: "stow_weapon_01",
            playerHit: "punch_hit_01",
        },
        lootImg: {
            sprite: "loot-weapon-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xff00,
        },
    },
    knuckles: {
        name: "Knuckles",
        type: "melee",
        quality: 0,
        autoAttack: false,
        switchDelay: 0.25,
        damage: 24,
        obstacleDamage: 1,
        noPotatoSwap: true,
        noDropOnDeath: true,
        attack: {
            offset: {
                x: 1.35,
                y: 0,
            },
            rad: 0.9,
            damageTimes: [0.1],
            cooldownTime: 0.25,
        },
        speed: {
            equip: 1,
            attack: 0,
        },
        anim: {
            idlePose: "fists",
            attackAnims: ["fists", "fists"],
        },
        sound: {
            pickup: "frag_pickup_01",
            swing: "punch_swing_01",
            deploy: "knuckles_deploy_01",
            playerHit: "punch_hit_01",
        },
        lootImg: {
            sprite: "loot-melee-knuckles-rusted.img",
            tint: 0xffffff,
            border: "loot-circle-outer-02.img",
            borderTint: 0xffffff,
            scale: 0.3,
            rad: 25,
            rot: 0.785,
        },
        worldImg: {
            sprite: "loot-melee-knuckles-rusted.img",
            pos: {
                x: 0,
                y: -27,
            },
            rot: 0.5 * Math.PI,
            scale: {
                x: 0.2,
                y: 0.2,
            },
            tint: 0xffffff,
        },
    },
    karambit: {
        name: "Karambit",
        type: "melee",
        quality: 0,
        autoAttack: false,
        switchDelay: 0.25,
        damage: 24,
        obstacleDamage: 1,
        noPotatoSwap: true,
        noDropOnDeath: true,
        attack: {
            offset: {
                x: 1.35,
                y: 0,
            },
            rad: 0.9,
            damageTimes: [0.1],
            cooldownTime: 0.25,
        },
        speed: {
            equip: 1,
        },
        anim: {
            idlePose: "slash",
            attackAnims: ["slash", "fists"],
        },
        sound: {
            pickup: "frag_pickup_01",
            swing: "knife_swing_01",
            deploy: "knife_deploy_01",
            playerHit: "knife_hit_01",
        },
        lootImg: {
            sprite: "loot-melee-karambit-rugged.img",
            tint: 0xffffff,
            border: "loot-circle-outer-02.img",
            borderTint: 0xffffff,
            scale: 0.3,
            mirror: true,
            rot: 2.35619,
        },
        worldImg: {
            sprite: "loot-melee-karambit-rugged.img",
            pos: {
                x: 15.5,
                y: -5,
            },
            rot: 0.5 * Math.PI,
            scale: {
                x: 0.35,
                y: 0.35,
            },
            tint: 0xffffff,
        },
    },
    bayonet: {
        name: "Bayonet",
        type: "melee",
        quality: 0,
        autoAttack: false,
        switchDelay: 0.25,
        damage: 24,
        obstacleDamage: 1,
        noPotatoSwap: true,
        noDropOnDeath: true,
        attack: {
            offset: {
                x: 1.35,
                y: 0,
            },
            rad: 0.9,
            damageTimes: [0.1],
            cooldownTime: 0.25,
        },
        speed: {
            equip: 1,
        },
        anim: {
            idlePose: "fists",
            attackAnims: ["cut", "thrust"],
        },
        sound: {
            pickup: "frag_pickup_01",
            swing: "knife_swing_01",
            deploy: "knife_deploy_01",
            playerHit: "knife_hit_01",
        },
        lootImg: {
            sprite: "loot-melee-bayonet-rugged.img",
            tint: 0xffffff,
            border: "loot-circle-outer-02.img",
            borderTint: 0xffffff,
            scale: 0.3,
            rot: 0.785,
        },
        worldImg: {
            sprite: "loot-melee-bayonet-rugged.img",
            pos: {
                x: -0.5,
                y: -32.5,
            },
            rot: 0.785,
            scale: {
                x: 0.35,
                y: 0.35,
            },
            tint: 0xffffff,
        },
    },
    huntsman: {
        name: "Huntsman",
        type: "melee",
        quality: 0,
        autoAttack: false,
        switchDelay: 0.25,
        damage: 24,
        obstacleDamage: 1,
        noPotatoSwap: true,
        noDropOnDeath: true,
        attack: {
            offset: {
                x: 1.35,
                y: 0,
            },
            rad: 0.9,
            damageTimes: [0.1],
            cooldownTime: 0.25,
        },
        speed: {
            equip: 1,
        },
        anim: {
            idlePose: "fists",
            attackAnims: ["cut", "thrust"],
        },
        sound: {
            pickup: "frag_pickup_01",
            swing: "knife_swing_01",
            deploy: "knife_deploy_01",
            playerHit: "knife_hit_01",
        },
        lootImg: {
            sprite: "loot-melee-huntsman-rugged.img",
            tint: 0xffffff,
            border: "loot-circle-outer-02.img",
            borderTint: 0xffffff,
            scale: 0.3,
            rot: 0.785,
        },
        worldImg: {
            sprite: "loot-melee-huntsman-rugged.img",
            pos: {
                x: 2.5,
                y: -35.5,
            },
            rot: 0.82,
            scale: {
                x: 0.35,
                y: 0.35,
            },
            tint: 0xffffff,
        },
    },
    bowie: {
        name: "Bowie",
        type: "melee",
        quality: 0,
        autoAttack: false,
        switchDelay: 0.25,
        damage: 24,
        obstacleDamage: 1,
        noPotatoSwap: true,
        noDropOnDeath: true,
        attack: {
            offset: {
                x: 1.35,
                y: 0,
            },
            rad: 0.9,
            damageTimes: [0.1],
            cooldownTime: 0.25,
        },
        speed: {
            equip: 1,
        },
        anim: {
            idlePose: "fists",
            attackAnims: ["cut", "thrust"],
        },
        sound: {
            pickup: "frag_pickup_01",
            swing: "knife_swing_01",
            deploy: "knife_deploy_01",
            playerHit: "knife_hit_01",
        },
        lootImg: {
            sprite: "loot-melee-bowie-vintage.img",
            tint: 0xffffff,
            border: "loot-circle-outer-02.img",
            borderTint: 0xffffff,
            scale: 0.3,
            rot: 0.785,
        },
        worldImg: {
            sprite: "loot-melee-bowie-vintage.img",
            pos: {
                x: -0.5,
                y: -32.5,
            },
            rot: 0.785,
            scale: {
                x: 0.35,
                y: 0.35,
            },
            tint: 0xffffff,
        },
    },
    machete: {
        name: "Machete",
        type: "melee",
        quality: 1,
        cleave: true,
        autoAttack: false,
        switchDelay: 0.25,
        damage: 33,
        obstacleDamage: 1,
        noPotatoSwap: true,
        attack: {
            offset: {
                x: 1.5,
                y: 0,
            },
            rad: 1.75,
            damageTimes: [0.12],
            cooldownTime: 0.3,
        },
        speed: {
            equip: 1,
        },
        anim: {
            idlePose: "machete",
            attackAnims: ["cutReverse"],
        },
        sound: {
            pickup: "frag_pickup_01",
            swing: "knife_swing_01",
            deploy: "knife_deploy_01",
            playerHit: "knife_hit_01",
        },
        lootImg: {
            sprite: "loot-melee-machete-taiga.img",
            tint: 0xffffff,
            border: "loot-circle-outer-02.img",
            borderTint: 0xffffff,
            scale: 0.3,
            rot: 0.785,
        },
        worldImg: {
            sprite: "loot-melee-machete-taiga.img",
            pos: {
                x: -2.5,
                y: -48.5,
            },
            rot: 1.885,
            scale: {
                x: 0.35,
                y: 0.35,
            },
            tint: 0xffffff,
        },
    },
    saw: {
        name: "Saw",
        type: "melee",
        quality: 1,
        cleave: true,
        autoAttack: false,
        switchDelay: 0.25,
        damage: 44,
        obstacleDamage: 1,
        noPotatoSwap: true,
        attack: {
            offset: {
                x: 2,
                y: 0,
            },
            rad: 1.75,
            damageTimes: [0.1, 0.5],
            cooldownTime: 0.7,
        },
        speed: {
            equip: 1,
        },
        anim: {
            idlePose: "machete",
            attackAnims: ["sawSwing"],
        },
        sound: {
            pickup: "frag_pickup_01",
            swing: "knife_swing_01",
            deploy: "knife_deploy_01",
            playerHit: "knife_hit_01",
            playerHit2: "saw_hit_01",
        },
        lootImg: {
            sprite: "loot-melee-bonesaw-rusted.img",
            mirror: true,
            tint: 0xffffff,
            border: "loot-circle-outer-02.img",
            borderTint: 0xffffff,
            scale: 0.3,
            rot: 0.785,
        },
        worldImg: {
            sprite: "loot-melee-bonesaw-rusted.img",
            pos: {
                x: -2.5,
                y: -48.5,
            },
            rot: 1.885,
            scale: {
                x: 0.35,
                y: 0.35,
            },
            tint: 0xffffff,
        },
    },
    woodaxe: {
        name: "Wood Axe",
        type: "melee",
        quality: 0,
        armorPiercing: true,
        autoAttack: false,
        switchDelay: 0.25,
        damage: 36,
        obstacleDamage: 1.92,
        attack: {
            offset: {
                x: 1.35,
                y: 0,
            },
            rad: 1,
            damageTimes: [0.18],
            cooldownTime: 0.36,
        },
        speed: {
            equip: 1,
        },
        anim: {
            idlePose: "meleeTwoHanded",
            attackAnims: ["axeSwing"],
        },
        sound: {
            pickup: "heavy_pickup_01",
            swing: "heavy_swing_01",
            deploy: "stow_weapon_01",
            playerHit: "axe_hit_01",
        },
        lootImg: {
            sprite: "loot-melee-woodaxe.img",
            tint: 0xffffff,
            border: "loot-circle-outer-02.img",
            borderTint: 0xffffff,
            scale: 0.3,
            mirror: true,
            rot: 2.35619,
        },
        worldImg: {
            sprite: "loot-melee-woodaxe.img",
            pos: {
                x: -12.5,
                y: -16,
            },
            rot: 1.2,
            scale: {
                x: 0.35,
                y: 0.35,
            },
            tint: 0xffffff,
            leftHandOntop: true,
        },
    },
    fireaxe: {
        name: "Fire Axe",
        type: "melee",
        quality: 1,
        armorPiercing: true,
        autoAttack: false,
        switchDelay: 0.25,
        damage: 44,
        obstacleDamage: 2.4,
        attack: {
            offset: {
                x: 1.35,
                y: 0,
            },
            rad: 1,
            damageTimes: [0.21],
            cooldownTime: 0.42,
        },
        speed: {
            equip: 1,
        },
        anim: {
            idlePose: "meleeTwoHanded",
            attackAnims: ["axeSwing"],
        },
        sound: {
            pickup: "heavy_pickup_01",
            swing: "heavy_swing_01",
            deploy: "stow_weapon_01",
            playerHit: "axe_hit_01",
        },
        lootImg: {
            sprite: "loot-melee-fireaxe.img",
            tint: 0xffffff,
            border: "loot-circle-outer-02.img",
            borderTint: 0xffffff,
            scale: 0.3,
            mirror: true,
            rot: 2.35619,
        },
        worldImg: {
            sprite: "loot-melee-fireaxe.img",
            pos: {
                x: -12.5,
                y: -4,
            },
            rot: 1.2,
            scale: {
                x: 0.35,
                y: 0.35,
            },
            tint: 0xffffff,
            leftHandOntop: true,
        },
    },
    katana: {
        name: "Katana",
        type: "melee",
        quality: 0,
        armorPiercing: true,
        cleave: true,
        autoAttack: false,
        switchDelay: 0.25,
        damage: 40,
        obstacleDamage: 1.5,
        attack: {
            offset: {
                x: 1.75,
                y: 0,
            },
            rad: 2,
            damageTimes: [0.2],
            cooldownTime: 0.4,
        },
        speed: {
            equip: 1,
        },
        anim: {
            idlePose: "meleeKatana",
            attackAnims: ["katanaSwing"],
        },
        sound: {
            pickup: "frag_pickup_01",
            swing: "medium_swing_01",
            deploy: "stow_weapon_01",
            playerHit: "knife_hit_01",
        },
        lootImg: {
            sprite: "loot-melee-katana.img",
            tint: 0xffffff,
            border: "loot-circle-outer-02.img",
            borderTint: 0xffffff,
            scale: 0.3,
            mirror: true,
            rot: 2.35619,
        },
        worldImg: {
            sprite: "loot-melee-katana.img",
            pos: {
                x: 52.5,
                y: -2,
            },
            rot: 3,
            scale: {
                x: 0.35,
                y: 0.35,
            },
            tint: 0xffffff,
            leftHandOntop: true,
        },
    },
    naginata: {
        name: "Naginata",
        type: "melee",
        quality: 1,
        armorPiercing: true,
        cleave: true,
        autoAttack: false,
        switchDelay: 0.25,
        damage: 56,
        obstacleDamage: 1.92,
        attack: {
            offset: {
                x: 3.5,
                y: 0,
            },
            rad: 2,
            damageTimes: [0.27],
            cooldownTime: 0.54,
        },
        speed: {
            equip: 1,
        },
        anim: {
            idlePose: "meleeNaginata",
            attackAnims: ["naginataSwing"],
        },
        sound: {
            pickup: "heavy_pickup_01",
            swing: "heavy_swing_01",
            deploy: "stow_weapon_01",
            playerHit: "axe_hit_01",
        },
        lootImg: {
            sprite: "loot-melee-naginata.img",
            tint: 0xffffff,
            border: "loot-circle-outer-02.img",
            borderTint: 0xffffff,
            scale: 0.3,
            mirror: true,
            rot: 2.35619,
        },
        worldImg: {
            sprite: "loot-melee-naginata.img",
            pos: {
                x: 42.5,
                y: -3,
            },
            rot: 1.9,
            scale: {
                x: 0.35,
                y: 0.35,
            },
            tint: 0xffffff,
            leftHandOntop: true,
        },
    },
    stonehammer: {
        name: "Stone Hammer",
        type: "melee",
        quality: 1,
        armorPiercing: true,
        stonePiercing: true,
        autoAttack: false,
        switchDelay: 0.25,
        damage: 60,
        obstacleDamage: 1.92,
        attack: {
            offset: {
                x: 1.35,
                y: 0,
            },
            rad: 1.25,
            damageTimes: [0.25],
            cooldownTime: 0.5,
        },
        speed: {
            equip: 1,
        },
        anim: {
            idlePose: "meleeTwoHanded",
            attackAnims: ["hammerSwing"],
        },
        sound: {
            pickup: "heavy_pickup_01",
            swing: "heavy_swing_01",
            deploy: "stow_weapon_01",
            playerHit: "hammer_hit_01",
        },
        lootImg: {
            sprite: "loot-melee-stonehammer.img",
            tint: 0xffffff,
            border: "loot-circle-outer-02.img",
            borderTint: 0xffffff,
            scale: 0.3,
            mirror: true,
            rot: 2.35619,
        },
        worldImg: {
            sprite: "loot-melee-stonehammer.img",
            pos: {
                x: -12.5,
                y: -4,
            },
            rot: 1.2,
            scale: {
                x: 0.35,
                y: 0.35,
            },
            tint: 0xffffff,
            leftHandOntop: true,
        },
    },
    iceaxe: {
        name: "Ice Axe",
        type: "melee",
        quality: 1,
        armorPiercing: true,
        stonePiercing: true,
        autoAttack: false,
        switchDelay: 0.25,
        damage: 44,
        obstacleDamage: 2.4,
        attack: {
            offset: {
                x: 1.4,
                y: 0,
            },
            rad: 1.3,
            damageTimes: [0.21],
            cooldownTime: 0.4,
        },
        speed: {
            equip: 1,
        },
        lootImg: {
            sprite: "loot-melee-ice_pick.img",
            tint: 0xffffff,
            border: "loot-circle-outer-02.img",
            borderTint: 0xffffff,
            scale: 0.3,
            mirror: true,
            rot: 2.35619,
        },
        worldImg: {
            sprite: "loot-melee-ice_pick.img",
            pos: {
                x: -12.5,
                y: -10,
            },
            rot: 1.2,
            scale: {
                x: 0.4,
                y: 0.4,
            },
            tint: 0xffffff,
            leftHandOntop: true,
        },
        anim: {
            idlePose: "meleeTwoHanded",
            attackAnims: ["axeSwing"],
        },
        sound: {
            pickup: "heavy_pickup_01",
            swing: "medium_swing_01",
            deploy: "stow_weapon_01",
            playerHit: "knife_hit_01",
        },
    },
    hook: {
        name: "Hook",
        type: "melee",
        quality: 1,
        autoAttack: true,
        switchDelay: 0.25,
        damage: 18,
        obstacleDamage: 1,
        attack: {
            offset: {
                x: 1.5,
                y: 0,
            },
            rad: 1,
            damageTimes: [0.075],
            cooldownTime: 0.175,
        },
        speed: {
            equip: 1,
        },
        anim: {
            idlePose: "fists",
            attackAnims: ["hook"],
        },
        sound: {
            pickup: "frag_pickup_01",
            swing: "knife_swing_01",
            deploy: "stow_weapon_01",
            playerHit: "hook_hit_01",
        },
        lootImg: {
            sprite: "loot-melee-hook-silver.img",
            tint: 0xffffff,
            border: "loot-circle-outer-02.img",
            borderTint: 0xffffff,
            scale: 0.3,
            rot: 0.785,
        },
        worldImg: {
            sprite: "loot-melee-hook-silver.img",
            pos: {
                x: 0,
                y: -27,
            },
            rot: 0.5 * Math.PI,
            scale: {
                x: 0.35,
                y: 0.35,
            },
            tint: 0xffffff,
            renderOnHand: true,
        },
    },
    pan: {
        name: "Pan",
        type: "melee",
        quality: 1,
        autoAttack: false,
        switchDelay: 0.25,
        damage: 60,
        obstacleDamage: 0.8,
        attack: {
            offset: {
                x: 2,
                y: 0,
            },
            rad: 1.5,
            damageTimes: [0.15],
            cooldownTime: 0.5,
        },
        speed: {
            equip: 1,
        },
        anim: {
            idlePose: "fists",
            attackAnims: ["pan"],
        },
        sound: {
            pickup: "pan_pickup_01",
            swing: "heavy_swing_01",
            deploy: "pan_pickup_01",
            playerHit: "pan_hit_01",
            bullet: "pan_bullet",
        },
        lootImg: {
            sprite: "loot-melee-pan-black.img",
            tint: 0xffffff,
            border: "loot-circle-outer-02.img",
            borderTint: 0xffffff,
            scale: 0.3,
            rot: -0.785,
        },
        worldImg: {
            sprite: "loot-melee-pan-black-side.img",
            pos: {
                x: 0,
                y: -40,
            },
            rot: 1.125,
            scale: {
                x: 0.35,
                y: 0.35,
            },
            tint: 0xffffff,
        },
        hipImg: {
            sprite: "loot-melee-pan-black-side.img",
            pos: {
                x: -17.25,
                y: 7.5,
            },
            rot: 0.78 * Math.PI,
            scale: {
                x: 0.3,
                y: 0.3,
            },
            tint: 0xffffff,
        },
        reflectSurface: {
            equipped: {
                p0: {
                    x: 2.65,
                    y: -0.125,
                },
                p1: {
                    x: 1.35,
                    y: -0.74,
                },
            },
            unequipped: {
                p0: {
                    x: -0.625,
                    y: -1.2,
                },
                p1: {
                    x: -1.4,
                    y: -0.25,
                },
            },
        },
    },
    spade: {
        name: "Spade",
        type: "melee",
        quality: 1,
        cleave: false,
        autoAttack: false,
        switchDelay: 0.25,
        damage: 40,
        obstacleDamage: 1,
        noPotatoSwap: true,
        attack: {
            offset: {
                x: 1.75,
                y: 0,
            },
            rad: 1.5,
            damageTimes: [0.12],
            cooldownTime: 0.35,
        },
        speed: {
            equip: 1,
        },
        anim: {
            idlePose: "fists",
            attackAnims: ["cut", "thrust"],
        },
        sound: {
            pickup: "heavy_pickup_01",
            swing: "knife_swing_01",
            deploy: "stow_weapon_01",
            playerHit: "spade_hit_01",
        },
        lootImg: {
            sprite: "loot-melee-spade-assault.img",
            tint: 0xffffff,
            border: "loot-circle-outer-02.img",
            borderTint: 0xffffff,
            scale: 0.3,
            rot: 0.785,
        },
        worldImg: {
            sprite: "loot-melee-spade-assault.img",
            pos: {
                x: -0.5,
                y: -41.5,
            },
            rot: 1,
            scale: {
                x: 0.35,
                y: 0.35,
            },
            tint: 0xffffff,
        },
    },
    crowbar: {
        name: "Crowbar",
        type: "melee",
        quality: 1,
        cleave: false,
        autoAttack: false,
        switchDelay: 0.25,
        damage: 33,
        obstacleDamage: 1.4,
        noPotatoSwap: true,
        attack: {
            offset: {
                x: 1.25,
                y: 0,
            },
            rad: 1.25,
            damageTimes: [0.12],
            cooldownTime: 0.3,
        },
        speed: {
            equip: 1,
        },
        anim: {
            idlePose: "fists",
            attackAnims: ["cut", "cutReverseShort"],
        },
        sound: {
            pickup: "frag_pickup_01",
            swing: "knife_swing_01",
            deploy: "frag_pickup_01",
            playerHit: "crowbar_hit_01",
        },
        lootImg: {
            sprite: "loot-melee-crowbar-scout.img",
            tint: 0xffffff,
            border: "loot-circle-outer-02.img",
            borderTint: 0xffffff,
            scale: 0.3,
            rot: 0.785,
        },
        worldImg: {
            sprite: "loot-melee-crowbar-scout.img",
            pos: {
                x: -1,
                y: -10,
            },
            rot: 1,
            scale: {
                x: 0.35,
                y: 0.35,
            },
            tint: 0xffffff,
        },
    },
    lasr_swrd: {
        name: "Lasr Swrd",
        type: "melee",
        quality: 1,
        armorPiercing: true,
        stonePiercing: true,
        autoAttack: false,
        switchDelay: 0.25,
        damage: 30, // 60
        obstacleDamage: 1.5,
        attack: {
            offset: { x: 2, y: 0 },
            rad: 2.1,
            damageTimes: [0.3],
            cooldownTime: 0.6,
        },
        speed: {
            equip: -7,
        },
        anim: {
            idlePose: "meleeLasrSwrd",
            attackAnims: ["lasrSwrdSwing"],
            poseAnims: ["lasrSwrd_pose_1", "lasrSwrd_pose_2", "lasrSwrd_pose_3"]
        },
        sound: {
            pickup: "frag_pickup_01",
            swing: "lasr_swing_01",
            deploy: "stow_weapon_01",
            playerHit: "lasr_hit_01"
        },
        lootImg: {
            sprite: "loot-melee-lasr-sword-01.img",
            tint: 0xffffff,
            border: "loot-circle-outer-02.img",
            borderTint: 0xffffff,
            scale: 0.3,
            mirror: true,
            rot: 0.0,
        },
        worldImg: {
            sprite: "lasr-sword-01.img",
            pos: { x: 110.0, y: -2.0 },
            rot: 0.0,
            scale: { x: 0.15, y: 0.15 },
            tint: 0xffffff,
            leftHandOntop: true,
        },
        reflectArea: {
            offset: { x: 1.75, y: 0.0 },
            rad: 1
        }
    },
};

const SkinDefs: Record<string, MeleeDef> = {
    fists: defineMeleeSkin("fists", {
        name: "Fists",
        rarity: Rarity.Stock,
        lore: "The old one-two.",
    }),
    red_gloves: defineMeleeSkin("fists", {
        name: "Red Gloves",
        rarity: Rarity.Stock,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-melee-red-gloves.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-gloves-01.img",
            spriteR: "player-fists-gloves-02.img",
        },
        scale: {
            x: 0.185,
            y: 0.185,
        },
    }),
    feral_gloves: defineMeleeSkin("fists", {
        name: "Feral Claws",
        rarity: Rarity.Stock,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-melee-feral-claws.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-feral-claws.img",
            spriteR: "player-fists-feral-claws.img",
        },
        scale: {
            x: 0.19,
            y: 0.19,
        },
    }),
    crab_gloves: defineMeleeSkin("fists", {
        name: "Crab Claws",
        rarity: Rarity.Stock,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-melee-crab-tongs.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-crab-tongs-01.img",
            spriteR: "player-fists-crab-tongs-02.img",
        },
        scale: {
            x: 0.185,
            y: 0.185,
        },
    }),
    fist_blueVelvet: defineMeleeSkin("fists", {
        name: "Blue Velvet",
        rarity: Rarity.Uncommon,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-melee-BlueVelvet.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-hands-BlueVelvet.img",
            spriteR: "player-hands-BlueVelvet.img",
        },
    }),
    fist_split: defineMeleeSkin("fists", {
        name: "Split the diff",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-melee-SpliTheDiff.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-hands-SpliTheDiff.img",
            spriteR: "player-hands-SpliTheDiff.img",
        },
    }),
    fist_frostpunch: defineMeleeSkin("fists", {
        name: "Frostpunch",
        rarity: Rarity.Mythic,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-melee-FrostPunch.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-hands-FrostPunch.img",
            spriteR: "player-hands-FrostPunch.img",
        },
    }),
    fist_immolate: defineMeleeSkin("fists", {
        name: "Immolate",
        rarity: Rarity.Uncommon,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-melee-immolate.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-hands-immolate.img",
            spriteR: "player-hands-immolate.img",
        },
    }),
    fist_bulletbills: defineMeleeSkin("fists", {
        name: "Bullet Bills",
        rarity: Rarity.Uncommon,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-melee-bulletbills.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-hands-bulletbills.img",
            spriteR: "player-hands-bulletbills.img",
        },
    }),
    fist_moss: defineMeleeSkin("fists", {
        name: "Moss",
        rarity: Rarity.Uncommon,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-melee-moss.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-hands-moss.img",
            spriteR: "player-hands-moss.img",
        },
    }),
    fist_blackholes: defineMeleeSkin("fists", {
        name: "Black Holes",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lore: "Created by Shad0wy_F1gure",
        lootImg: {
            sprite: "loot-melee-blackholes.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-hands-blackholes.img",
            spriteR: "player-hands-blackholes.img",
        },
    }),
    fist_rainbowhands: defineMeleeSkin("fists", {
        name: "Rainbow Hands",
        rarity: Rarity.Epic,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-melee-rainbowhands.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-hands-rainbowhands.img",
            spriteR: "player-hands-rainbowhands.img",
        },
    }),
    fist_darklets: defineMeleeSkin("fists", {
        name: "Darklets",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-melee-darklets.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-hands-darklets.img",
            spriteR: "player-hands-darklets.img",
        },
    }),
    fist_scifi: defineMeleeSkin("fists", {
        name: "Flynn",
        rarity: Rarity.Epic,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-melee-scifi.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-hands-scifi.img",
            spriteR: "player-hands-scifi.img",
        },
    }),
    fist_poke: defineMeleeSkin("fists", {
        name: "Poke",
        rarity: Rarity.Mythic,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-melee-poke.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-hands-poke.img",
            spriteR: "player-hands-poke.img",
        },
    }),
    fist_paws: defineMeleeSkin("fists", {
        name: "Paws",
        rarity: Rarity.Mythic,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-melee-paws.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-hands-paws.img",
            spriteR: "player-hands-paws.img",
        },
    }),
    fist_dinoclaws: defineMeleeSkin("fists", {
        name: "Raptor",
        rarity: Rarity.Mythic,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-melee-dinoclaws.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-hands-dinoclaws.img",
            spriteR: "player-hands-dinoclaws.img",
        },
    }),
    fist_leaf: defineMeleeSkin("fists", {
        name: "Tree Puncher",
        rarity: Rarity.Epic,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-melee-leaf.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-hands-leaf-left.img",
            spriteR: "player-hands-leaf-right.img",
        },
    }),
    fist_ranger: defineMeleeSkin("fists", {
        name: "Ranger",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-melee-ranger.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-hands-ranger.img",
            spriteR: "player-hands-ranger.img",
        },
    }),
    fist_linedUp: defineMeleeSkin("fists", {
        name: "Lined Up",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-melee-linedUp.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-hands-linedUp.img",
            spriteR: "player-hands-linedUp.img",
        },
    }),
    fist_lit: defineMeleeSkin("fists", {
        name: "Lit",
        rarity: Rarity.Uncommon,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-melee-lit.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-hands-lit-left.img",
            spriteR: "player-hands-lit-right.img",
        },
    }),
    fist_gift_punch: defineMeleeSkin("fists", {
        name: "Gift Punch",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-gift-punch-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-gift-puch.img",
            spriteR: "player-fists-gift-puch.img",
        },
    }),
    fist_ember: defineMeleeSkin("fists", {
        name: "Ember",
        rarity: Rarity.Uncommon,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-ember-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-ember-l.img",
            spriteR: "player-fists-ember-r.img",
        },
    }),
    fist_santa: defineMeleeSkin("fists", {
        name: "Santa Mittens",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-santa-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-santa-l.img",
            spriteR: "player-fists-santa-r.img",
        },
    }),
    fist_purptog: defineMeleeSkin("fists", {
        name: "Purptog",
        rarity: Rarity.Epic,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-purptog-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-purptog.img",
            spriteR: "player-fists-purptog.img",
        },
    }),
    fist_golden_lobster: defineMeleeSkin("fists", {
        name: "Golden Lobster",
        rarity: Rarity.Mythic,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-golden-lobster-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-golden-lobster-l.img",
            spriteR: "player-fists-golden-lobster-r.img",
        },
    }),
    fist_pineFury: defineMeleeSkin("fists", {
        name: "Pine Fury",
        rarity: Rarity.Mythic,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-melee-pineFury.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-hands-pineFury-left.img",
            spriteR: "player-hands-pineFury-right.img",
        },
    }),
    fist_dreidel: defineMeleeSkin("fists", {
        name: "Dreidel",
        rarity: Rarity.Epic,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-melee-dreidel.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-hands-dreidel-left.img",
            spriteR: "player-hands-dreidel-right.img",
        },
    }),
    fist_bePresent: defineMeleeSkin("fists", {
        name: "Be Present",
        rarity: Rarity.Epic,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-melee-bePresent.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-hands-bePresent-left.img",
            spriteR: "player-hands-bePresent-right.img",
        },
    }),
    fist_101spots: defineMeleeSkin("fists", {
        name: "101 Spots",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-101-spots-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-101-spots-l.img",
            spriteR: "player-fists-101-spots-r.img",
        },
    }),
    fist_atNet: defineMeleeSkin("fists", {
        name: "At Net",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-at-net-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-at-net-l.img",
            spriteR: "player-fists-at-net-r.img",
        },
    }),
    fist_badMitten: defineMeleeSkin("fists", {
        name: "Bad Mitten",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-bad-mitten-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-bad-mitten-l.img",
            spriteR: "player-fists-bad-mitten-r.img",
        },
    }),
    fist_beachBallin: defineMeleeSkin("fists", {
        name: "Beach Ballin",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-beach-ballin-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-beach-ballin-l.img",
            spriteR: "player-fists-beach-ballin-r.img",
        },
    }),
    fist_bloody: defineMeleeSkin("fists", {
        name: "Bloody",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-bloody-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-bloody-l.img",
            spriteR: "player-fists-bloody-r.img",
        },
    }),
    fist_bologna: defineMeleeSkin("fists", {
        name: "Bologna",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-bologna-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-bologna-l.img",
            spriteR: "player-fists-bologna-r.img",
        },
    }),
    fist_bonkbonk: defineMeleeSkin("fists", {
        name: "Bonk Bonk",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-bonkbonk-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-bonkbonk-l.img",
            spriteR: "player-fists-bonkbonk-r.img",
        },
    }),
    fist_boogieStripes: defineMeleeSkin("fists", {
        name: "Boogie Stripes",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-boogie-stripes-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-boogie-stripes-l.img",
            spriteR: "player-fists-boogie-stripes-r.img",
        },
    }),
    fist_bullsEye: defineMeleeSkin("fists", {
        name: "Bulls Eye",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-bulls-eye-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-bulls-eye-l.img",
            spriteR: "player-fists-bulls-eye-r.img",
        },
    }),
    fist_cattleBattle: defineMeleeSkin("fists", {
        name: "Cattle Battle",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-cattle-battle-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-cattle-battle-l.img",
            spriteR: "player-fists-cattle-battle-r.img",
        },
    }),
    fist_cocoNut: defineMeleeSkin("fists", {
        name: "Coco Nut",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-coco-nut-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-coco-nut-l.img",
            spriteR: "player-fists-coco-nut-r.img",
        },
    }),
    fist_condimentium: defineMeleeSkin("fists", {
        name: "Condimentium",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-condimentium-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-condimentium-l.img",
            spriteR: "player-fists-condimentium-r.img",
        },
    }),
    fist_dPunchPad: defineMeleeSkin("fists", {
        name: "D-Punch Pad",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-d-punch-pad-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-d-punch-pad-l.img",
            spriteR: "player-fists-d-punch-pad-r.img",
        },
    }),
    fist_developTheseRolls: defineMeleeSkin("fists", {
        name: "Develop These Rolls",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-develop-these-rolls-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-develop-these-rolls-l.img",
            spriteR: "player-fists-develop-these-rolls-r.img",
        },
    }),
    fist_dishSoap: defineMeleeSkin("fists", {
        name: "Dish Soap",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-dish-soap-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-dish-soap-l.img",
            spriteR: "player-fists-dish-soap-r.img",
        },
    }),
    fist_dizzieLocs: defineMeleeSkin("fists", {
        name: "Dizzie Locs",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-dizzie-locs-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-dizzie-locs-l.img",
            spriteR: "player-fists-dizzie-locs-r.img",
        },
    }),
    fist_firstTool: defineMeleeSkin("fists", {
        name: "First Tool",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-first-tool-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-first-tool-l.img",
            spriteR: "player-fists-first-tool-r.img",
        },
    }),
    fist_flamingNucleus: defineMeleeSkin("fists", {
        name: "Flaming Nucleus",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-flaming-nucleus-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-flaming-nucleus-l.img",
            spriteR: "player-fists-flaming-nucleus-r.img",
        },
    }),
    fist_flashy: defineMeleeSkin("fists", {
        name: "Flashy",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-flashy-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-flashy-l.img",
            spriteR: "player-fists-flashy-r.img",
        },
    }),
    fist_fritterPunch: defineMeleeSkin("fists", {
        name: "Fritter Punch",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-fritter-punch-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-fritter-punch-l.img",
            spriteR: "player-fists-fritter-punch-r.img",
        },
    }),
    fist_fuzzyHooves: defineMeleeSkin("fists", {
        name: "Fuzzy Hooves",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-fuzzy-hooves-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-fuzzy-hooves-l.img",
            spriteR: "player-fists-fuzzy-hooves-r.img",
        },
    }),
    fist_garbanjo: defineMeleeSkin("fists", {
        name: "Garbanjo",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-garbanjo-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-garbanjo-l.img",
            spriteR: "player-fists-garbanjo-r.img",
        },
    }),
    fist_getdowntonite: defineMeleeSkin("fists", {
        name: "Get Down Tonight",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-getdowntonite-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-getdowntonite-l.img",
            spriteR: "player-fists-getdowntonite-r.img",
        },
    }),
    fist_ghostPoke: defineMeleeSkin("fists", {
        name: "Ghost Poke",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-ghost-poke-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-ghost-poke-l.img",
            spriteR: "player-fists-ghost-poke-r.img",
        },
    }),
    fist_goldDrops: defineMeleeSkin("fists", {
        name: "Gold Drops",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-gold-drops-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-gold-drops-l.img",
            spriteR: "player-fists-gold-drops-r.img",
        },
    }),
    fist_graphbars: defineMeleeSkin("fists", {
        name: "Graphbars",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-graphbars-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-graphbars-l.img",
            spriteR: "player-fists-graphbars-r.img",
        },
    }),
    fist_grizzly: defineMeleeSkin("fists", {
        name: "Grizzly",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-grizzly-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-grizzly-l.img",
            spriteR: "player-fists-grizzly-r.img",
        },
    }),
    fist_horsepower: defineMeleeSkin("fists", {
        name: "Horsepower",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-horsepower-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-horsepower-l.img",
            spriteR: "player-fists-horsepower-r.img",
        },
    }),
    fist_inkyBusiness: defineMeleeSkin("fists", {
        name: "Inky Business",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-inky-business-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-inky-business-l.img",
            spriteR: "player-fists-inky-business-r.img",
        },
    }),
    fist_lolitaPop: defineMeleeSkin("fists", {
        name: "Lolita Pop",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-lolita-pop-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-lolita-pop-l.img",
            spriteR: "player-fists-lolita-pop-r.img",
        },
    }),
    fist_makeAChoice: defineMeleeSkin("fists", {
        name: "Make A Choice",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-make-a-choice-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-make-a-choice-l.img",
            spriteR: "player-fists-make-a-choice-r.img",
        },
    }),
    fist_marbleRun: defineMeleeSkin("fists", {
        name: "Marble Run",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-marble-run-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-marble-run-l.img",
            spriteR: "player-fists-marble-run-r.img",
        },
    }),
    fist_meteorNite: defineMeleeSkin("fists", {
        name: "Meteor Nite",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-meteor-nite-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-meteor-nite-l.img",
            spriteR: "player-fists-meteor-nite-r.img",
        },
    }),
    fist_milestones: defineMeleeSkin("fists", {
        name: "Milestones",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-milestones-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-milestones-l.img",
            spriteR: "player-fists-milestones-r.img",
        },
    }),
    fist_milkshaked: defineMeleeSkin("fists", {
        name: "Milkshaked",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-milkshaked-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-milkshaked-l.img",
            spriteR: "player-fists-milkshaked-r.img",
        },
    }),
    fist_noPineNoGain: defineMeleeSkin("fists", {
        name: "No Pine No Gain",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-no-pine-no-gain-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-no-pine-no-gain-l.img",
            spriteR: "player-fists-no-pine-no-gain-r.img",
        },
    }),
    fist_orangeLime: defineMeleeSkin("fists", {
        name: "Orange Lime",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-orange-lime-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-orange-lime-l.img",
            spriteR: "player-fists-orange-lime-r.img",
        },
    }),
    fist_orangeMintstones: defineMeleeSkin("fists", {
        name: "Orange Mintstones",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-orange-mintstones-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-orange-mintstones-l.img",
            spriteR: "player-fists-orange-mintstones-r.img",
        },
    }),
    fist_paddle: defineMeleeSkin("fists", {
        name: "Paddle",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-paddle-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-paddle-l.img",
            spriteR: "player-fists-paddle-r.img",
        },
    }),
    fist_pixelDots: defineMeleeSkin("fists", {
        name: "Pixel Dots",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-pixel-dots-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-pixel-dots-l.img",
            spriteR: "player-fists-pixel-dots-r.img",
        },
    }),
    fist_purpleShutter: defineMeleeSkin("fists", {
        name: "Purple Shutter",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-purple-shutter-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-purple-shutter-l.img",
            spriteR: "player-fists-purple-shutter-r.img",
        },
    }),
    fist_qFist: defineMeleeSkin("fists", {
        name: "Q Fist",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-q-fist-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-q-fist-l.img",
            spriteR: "player-fists-q-fist-r.img",
        },
    }),
    fist_rafflesia: defineMeleeSkin("fists", {
        name: "Rafflesia",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-rafflesia-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-rafflesia-l.img",
            spriteR: "player-fists-rafflesia-r.img",
        },
    }),
    fist_ranchChips: defineMeleeSkin("fists", {
        name: "Ranch Chips",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-ranch-chips-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-ranch-chips-l.img",
            spriteR: "player-fists-ranch-chips-r.img",
        },
    }),
    fist_retrhorizon: defineMeleeSkin("fists", {
        name: "Retro Horizon",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-retrhorizon-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-retrhorizon-l.img",
            spriteR: "player-fists-retrhorizon-r.img",
        },
    }),
    fist_shinyJello: defineMeleeSkin("fists", {
        name: "Shiny Jello",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-shiny-jello-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-shiny-jello-l.img",
            spriteR: "player-fists-shiny-jello-r.img",
        },
    }),
    fist_spongeGuy: defineMeleeSkin("fists", {
        name: "Sponge Guy",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-sponge-guy-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-sponge-guy-l.img",
            spriteR: "player-fists-sponge-guy-r.img",
        },
    }),
    fist_squareyCerry: defineMeleeSkin("fists", {
        name: "Squarey Cherry",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-squarey-cherry-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-squarey-cherry-l.img",
            spriteR: "player-fists-squarey-cherry-r.img",
        },
    }),
    fist_stonedgy: defineMeleeSkin("fists", {
        name: "Stonedgy",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-stonedgy-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-stonedgy-l.img",
            spriteR: "player-fists-stonedgy-r.img",
        },
    }),
    fist_tawget: defineMeleeSkin("fists", {
        name: "Tawget",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-tawget-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-tawget-l.img",
            spriteR: "player-fists-tawget-r.img",
        },
    }),
    fist_theOtherPong: defineMeleeSkin("fists", {
        name: "The Other Pong",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-the-other-pong-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-the-other-pong-l.img",
            spriteR: "player-fists-the-other-pong-r.img",
        },
    }),
    fist_tigerSeed: defineMeleeSkin("fists", {
        name: "Tiger Seed",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-tiger-seed-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-tiger-seed-l.img",
            spriteR: "player-fists-tiger-seed-r.img",
        },
    }),
    fist_tropicana: defineMeleeSkin("fists", {
        name: "Tropicana",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-tropicana-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-tropicana-l.img",
            spriteR: "player-fists-tropicana-r.img",
        },
    }),
    fist_upAndAtom: defineMeleeSkin("fists", {
        name: "Up And Atom",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-up-and-atom-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-up-and-atom-l.img",
            spriteR: "player-fists-up-and-atom-r.img",
        },
    }),
    fist_vitaminC: defineMeleeSkin("fists", {
        name: "Vitamin C",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-vitamin-c-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-vitamin-c-l.img",
            spriteR: "player-fists-vitamin-c-r.img",
        },
    }),
    fist_washiLamps: defineMeleeSkin("fists", {
        name: "Washi Lamps",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-washi-lamps-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-washi-lamps-l.img",
            spriteR: "player-fists-washi-lamps-r.img",
        },
    }),
    fist_watermelon: defineMeleeSkin("fists", {
        name: "Watermelon",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-watermelon-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-watermelon-l.img",
            spriteR: "player-fists-watermelon-r.img",
        },
    }),
    fist_woodyAllan: defineMeleeSkin("fists", {
        name: "Woody Allan",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-woody-allan-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-woody-allan-l.img",
            spriteR: "player-fists-woody-allan-r.img",
        },
    }),
    fist_wreckedAngle: defineMeleeSkin("fists", {
        name: "Wrecked Angle",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-wrecked-angle-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-wrecked-angle-l.img",
            spriteR: "player-fists-wrecked-angle-r.img",
        },
    }),
    knuckles_rusted: defineMeleeSkin("knuckles", {
        name: "Knuckles Rusted",
        rarity: Rarity.Uncommon,
        lore: "Rust up for the dust up.",
        noPotatoSwap: false,
        lootImg: {
            sprite: "loot-melee-knuckles-rusted.img",
        },
        worldImg: {
            sprite: "loot-melee-knuckles-rusted.img",
        },
    }),
    knuckles_heroic: defineMeleeSkin("knuckles", {
        name: "Knuckles Heroic",
        rarity: Rarity.Rare,
        lore: "Give 'em a hero sandwich.",
        noPotatoSwap: false,
        lootImg: {
            sprite: "loot-melee-knuckles-heroic.img",
        },
        worldImg: {
            sprite: "loot-melee-knuckles-heroic.img",
        },
    }),
    karambit_rugged: defineMeleeSkin("karambit", {
        name: "Karambit Rugged",
        rarity: Rarity.Rare,
        noPotatoSwap: false,
        anim: {
            idlePose: "slash",
            attackAnims: ["slash", "fists"],
        },
        lootImg: {
            sprite: "loot-melee-karambit-rugged.img",
        },
        worldImg: {
            sprite: "loot-melee-karambit-rugged.img",
        },
    }),
    karambit_prismatic: defineMeleeSkin("karambit", {
        name: "Karambit Prismatic",
        rarity: Rarity.Epic,
        noPotatoSwap: false,
        lootImg: {
            sprite: "loot-melee-karambit-prismatic.img",
        },
        worldImg: {
            sprite: "loot-melee-karambit-prismatic.img",
        },
    }),
    karambit_drowned: defineMeleeSkin("karambit", {
        name: "Karambit Drowned",
        rarity: Rarity.Epic,
        noPotatoSwap: false,
        lootImg: {
            sprite: "loot-melee-karambit-drowned.img",
        },
        worldImg: {
            sprite: "loot-melee-karambit-drowned.img",
        },
    }),
    bayonet_rugged: defineMeleeSkin("bayonet", {
        name: "Bayonet Rugged",
        rarity: Rarity.Rare,
        noPotatoSwap: false,
        lootImg: {
            sprite: "loot-melee-bayonet-rugged.img",
        },
        worldImg: {
            sprite: "loot-melee-bayonet-rugged.img",
        },
    }),
    bayonet_woodland: defineMeleeSkin("bayonet", {
        name: "Bayonet Woodland",
        rarity: Rarity.Epic,
        noPotatoSwap: false,
        lootImg: {
            sprite: "loot-melee-bayonet-woodland.img",
        },
        worldImg: {
            sprite: "loot-melee-bayonet-woodland.img",
        },
    }),
    huntsman_rugged: defineMeleeSkin("huntsman", {
        name: "Huntsman Rugged",
        rarity: Rarity.Rare,
        noPotatoSwap: false,
        lootImg: {
            sprite: "loot-melee-huntsman-rugged.img",
        },
        worldImg: {
            sprite: "loot-melee-huntsman-rugged.img",
        },
    }),
    huntsman_burnished: defineMeleeSkin("huntsman", {
        name: "Huntsman Burnished",
        rarity: Rarity.Epic,
        noPotatoSwap: false,
        lootImg: {
            sprite: "loot-melee-huntsman-burnished.img",
        },
        worldImg: {
            sprite: "loot-melee-huntsman-burnished.img",
        },
    }),
    bowie_vintage: defineMeleeSkin("bowie", {
        name: "Bowie Vintage",
        rarity: Rarity.Rare,
        noPotatoSwap: false,
        lootImg: { sprite: "loot-melee-bowie-vintage.img" },
        worldImg: {
            sprite: "loot-melee-bowie-vintage.img",
        },
    }),
    bowie_frontier: defineMeleeSkin("bowie", {
        name: "Bowie Frontier",
        rarity: Rarity.Epic,
        noPotatoSwap: false,
        lootImg: {
            sprite: "loot-melee-bowie-frontier.img",
        },
        worldImg: {
            sprite: "loot-melee-bowie-frontier.img",
        },
    }),
    machete_taiga: defineMeleeSkin("machete", {
        name: "UVSR Taiga",
        noPotatoSwap: false,
        lootImg: { sprite: "loot-melee-machete-taiga.img" },
        worldImg: {
            sprite: "loot-melee-machete-taiga.img",
        },
    }),
    kukri_trad: defineMeleeSkin("machete", {
        name: "Tallow's Kukri",
        noPotatoSwap: false,
        lootImg: { sprite: "loot-melee-kukri-trad.img" },
        worldImg: {
            sprite: "loot-melee-kukri-trad.img",
            pos: { x: -0.5, y: -46.5 },
        },
    }),
    bonesaw_rusted: defineMeleeSkin("saw", {
        name: "Bonesaw Rusted",
        noPotatoSwap: false,
        lootImg: {
            sprite: "loot-melee-bonesaw-rusted.img",
        },
        worldImg: {
            sprite: "loot-melee-bonesaw-rusted.img",
        },
    }),
    woodaxe_bloody: defineMeleeSkin("woodaxe", {
        name: "Axe Bloodstained",
        lootImg: {
            sprite: "loot-melee-woodaxe-bloody.img",
        },
        worldImg: {
            sprite: "loot-melee-woodaxe-bloody.img",
        },
    }),
    katana_rusted: defineMeleeSkin("katana", {
        name: "Katana Rusted",
        lootImg: { sprite: "loot-melee-katana-rusted.img" },
        worldImg: {
            sprite: "loot-melee-katana-rusted.img",
        },
    }),
    katana_orchid: defineMeleeSkin("katana", {
        name: "Katana Orchid",
        quality: 1,
        lootImg: { sprite: "loot-melee-katana-orchid.img" },
        worldImg: {
            sprite: "loot-melee-katana-orchid.img",
        },
    }),
    sledgehammer: defineMeleeSkin("stonehammer", {
        name: "Sledgehammer",
        lootImg: { sprite: "loot-melee-sledgehammer.img" },
        worldImg: {
            sprite: "loot-melee-sledgehammer.img",
            pos: { x: -12.5, y: -3.5 },
        },
    }),
    crowbar_scout: defineMeleeSkin("crowbar", {
        name: "Scouting Crowbar",
        noPotatoSwap: false,
    }),
    crowbar_recon: defineMeleeSkin("crowbar", {
        name: "Crowbar Carbon",
        noPotatoSwap: false,
        lootImg: { sprite: "loot-melee-crowbar-recon.img" },
        worldImg: {
            sprite: "loot-melee-crowbar-recon.img",
        },
    }),
    kukri_sniper: defineMeleeSkin("machete", {
        name: "Marksman's Recurve",
        noPotatoSwap: false,
        lootImg: { sprite: "loot-melee-kukri-sniper.img" },
        worldImg: {
            sprite: "loot-melee-kukri-sniper.img",
            pos: { x: -0.5, y: -46.5 },
        },
    }),
    bonesaw_healer: defineMeleeSkin("saw", {
        name: "The Separator",
        noPotatoSwap: false,
        lootImg: {
            sprite: "loot-melee-bonesaw-healer.img",
        },
        worldImg: {
            sprite: "loot-melee-bonesaw-healer.img",
        },
    }),
    katana_demo: defineMeleeSkin("katana", {
        name: "Hakai no Katana",
        lootImg: { sprite: "loot-melee-katana-demo.img" },
        worldImg: { sprite: "loot-melee-katana-demo.img" },
    }),
    spade_assault: defineMeleeSkin("spade", {
        name: "Trench Spade",
        noPotatoSwap: false,
    }),
    warhammer_tank: defineMeleeSkin("stonehammer", {
        name: "Panzerhammer",
        damage: 64,
        attack: {
            offset: { x: 1.5, y: 0 },
            rad: 1.75,
            damageTimes: [0.3],
            cooldownTime: 0.6,
        },
        lootImg: {
            sprite: "loot-melee-warhammer-tank.img",
        },
        worldImg: {
            sprite: "loot-melee-warhammer-tank.img",
            pos: { x: -10.5, y: -3 },
        },
    }),
    lasr_swrd_02: defineMeleeSkin("lasr_swrd", {
        lootImg: { sprite: "loot-melee-lasr-sword-02.img" },
        worldImg: { sprite: "lasr-sword-02.img" },
    }),
    lasr_swrd_03: defineMeleeSkin("lasr_swrd", {
        lootImg: { sprite: "loot-melee-lasr-sword-03.img" },
        worldImg: { sprite: "lasr-sword-03.img" },
    }),
};

export const MeleeDefs: Record<string, MeleeDef> = { ...BaseDefs, ...SkinDefs };
