import type { PrivateLobbyMiniGame } from "../../../shared/defs/miniGame";
import type { InventoryItem } from "../../../shared/gameConfig";

export interface PrivateLobbyMiniGameWeaponOverride {
    primary?: string;
    secondary?: string;
}

export interface HideAndSeekSettings {
    hiderTeam: "A";
    seekerTeam: "B";
    hiderPrimaryWeapon: string;
    hiderSecondaryWeapon: string;
    seekerPrimaryWeapon: string;
    seekerSecondaryWeapon?: string;
    hiderBlindThrowable: string;
    hiderBlindThrowableCount: number;
    hunterReleaseDelay: number;
    propSwitchLimit: number;
    seekerWrongPropDamage: number;
    seekerWrongPropDamageCooldown: number;
    hiderNoiseInterval: number;
    hiderNoisePing: string;
    hiderNoisePingOffsetRadius: number;
    hiderNoiseWeapon: string;
    hiderNoiseShotAlt: boolean;
    seekerSpeedMultiplier: number;
    seekerRemovedSpawnItems: InventoryItem[];
    seekerSpawnItems: Partial<Record<InventoryItem, number>>;
    seekerAdrenalineHeals: boolean;
}

export interface InfectedSettings {
    zombieTeam: "A";
    humanTeam: "B";
    humanPrimaryWeapon: string;
    zombieOutfit: string;
    humanOutfit: string;
    humanNoiseInterval: number;
    humanNoisePing: string;
    humanNoisePingOffsetRadius: number;
    humanNoiseWeapon: string;
    humanNoiseShotAlt: boolean;
    zombieSpeedMultiplier: number;
    zombieDamageReduction: number;
    zombieRespawnCooldown: number;
}

interface PrivateLobbyMiniGameServerSettings {
    hideAndSeek?: HideAndSeekSettings;
    infected?: InfectedSettings;
    getWeaponOverride?: (
        arenaTeam: "A" | "B" | undefined,
    ) => PrivateLobbyMiniGameWeaponOverride | undefined;
}

export const HideAndSeekSettings: HideAndSeekSettings = {
    hiderTeam: "A",
    seekerTeam: "B",
    hiderPrimaryWeapon: "prop_o_matic",
    hiderSecondaryWeapon: "",
    seekerPrimaryWeapon: "awc",
    hiderBlindThrowable: "flashbang",
    hiderBlindThrowableCount: 1,
    hunterReleaseDelay: 60,
    propSwitchLimit: 20,
    seekerWrongPropDamage: 20,
    seekerWrongPropDamageCooldown: 0.5,
    hiderNoiseInterval: 60,
    hiderNoisePing: "ping_hide_and_seek_noise",
    hiderNoisePingOffsetRadius: 16,
    hiderNoiseWeapon: "bugle",
    hiderNoiseShotAlt: false,
    seekerSpeedMultiplier: 1.2,
    seekerRemovedSpawnItems: ["bandage", "healthkit", "soda", "painkiller"],
    seekerSpawnItems: { bandage: 10 },
    seekerAdrenalineHeals: false,
};

export const InfectedSettings: InfectedSettings = {
    zombieTeam: "A",
    humanTeam: "B",
    humanPrimaryWeapon: "m9",
    zombieOutfit: "outfitBraaains",
    humanOutfit: "outfitBase",
    humanNoiseInterval: 60,
    humanNoisePing: "ping_hide_and_seek_noise",
    humanNoisePingOffsetRadius: 16,
    humanNoiseWeapon: "bugle",
    humanNoiseShotAlt: false,
    zombieSpeedMultiplier: 1.2,
    zombieDamageReduction: 0.4,
    zombieRespawnCooldown: 5,
};

export const PrivateLobbyMiniGameServerSettings: Record<
    PrivateLobbyMiniGame,
    PrivateLobbyMiniGameServerSettings
> = {
    pvp: {},
    hide_and_seek: {
        hideAndSeek: HideAndSeekSettings,
        getWeaponOverride: (arenaTeam) => {
            if (arenaTeam === HideAndSeekSettings.hiderTeam) {
                return {
                    primary: HideAndSeekSettings.hiderPrimaryWeapon,
                    secondary: HideAndSeekSettings.hiderSecondaryWeapon,
                };
            }

            if (arenaTeam === HideAndSeekSettings.seekerTeam) {
                return {
                    primary: HideAndSeekSettings.seekerPrimaryWeapon,
                    secondary: HideAndSeekSettings.seekerSecondaryWeapon,
                };
            }

            return undefined;
        },
    },
    infected: {
        infected: InfectedSettings,
        getWeaponOverride: (arenaTeam) => {
            if (arenaTeam === InfectedSettings.humanTeam) {
                return {
                    primary: InfectedSettings.humanPrimaryWeapon,
                    secondary: "",
                };
            }

            if (arenaTeam === InfectedSettings.zombieTeam) {
                return {
                    primary: "",
                    secondary: "",
                };
            }

            return undefined;
        },
    },
    among_us: {},
};

export function getPrivateLobbyMiniGameMapName(
    miniGame: PrivateLobbyMiniGame | undefined,
) {
    return miniGame === "among_us" ? "among_us" : undefined;
}

export function isAmongUsMiniGame(miniGame: PrivateLobbyMiniGame | undefined) {
    return miniGame === "among_us";
}

export function getPrivateLobbyMiniGameWeaponOverride(
    miniGame: PrivateLobbyMiniGame | undefined,
    arenaTeam: "A" | "B" | undefined,
): PrivateLobbyMiniGameWeaponOverride | undefined {
    if (!miniGame) return undefined;
    return PrivateLobbyMiniGameServerSettings[miniGame].getWeaponOverride?.(arenaTeam);
}

export function getHideAndSeekSettings(
    miniGame: PrivateLobbyMiniGame | undefined,
): HideAndSeekSettings | undefined {
    if (!miniGame) return undefined;
    return PrivateLobbyMiniGameServerSettings[miniGame].hideAndSeek;
}

export function getInfectedSettings(
    miniGame: PrivateLobbyMiniGame | undefined,
): InfectedSettings | undefined {
    if (!miniGame) return undefined;
    return PrivateLobbyMiniGameServerSettings[miniGame].infected;
}

export function isHideAndSeekHider(
    miniGame: PrivateLobbyMiniGame | undefined,
    arenaTeam: "A" | "B" | undefined,
) {
    const settings = getHideAndSeekSettings(miniGame);
    return !!settings && arenaTeam === settings.hiderTeam;
}

export function isHideAndSeekSeeker(
    miniGame: PrivateLobbyMiniGame | undefined,
    arenaTeam: "A" | "B" | undefined,
) {
    const settings = getHideAndSeekSettings(miniGame);
    return !!settings && arenaTeam === settings.seekerTeam;
}

export function isInfectedZombie(
    miniGame: PrivateLobbyMiniGame | undefined,
    arenaTeam: "A" | "B" | undefined,
) {
    const settings = getInfectedSettings(miniGame);
    return !!settings && arenaTeam === settings.zombieTeam;
}

export function isInfectedHuman(
    miniGame: PrivateLobbyMiniGame | undefined,
    arenaTeam: "A" | "B" | undefined,
) {
    const settings = getInfectedSettings(miniGame);
    return !!settings && arenaTeam === settings.humanTeam;
}
