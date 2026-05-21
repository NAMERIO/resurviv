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
    seekerRemovedSpawnItems: InventoryItem[];
    seekerSpawnItems: Partial<Record<InventoryItem, number>>;
    seekerAdrenalineHeals: boolean;
}

interface PrivateLobbyMiniGameServerSettings {
    hideAndSeek?: HideAndSeekSettings;
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
    hiderNoiseInterval: 5,
    hiderNoisePing: "ping_hide_and_seek_noise",
    hiderNoisePingOffsetRadius: 16,
    hiderNoiseWeapon: "bugle",
    hiderNoiseShotAlt: false,
    seekerRemovedSpawnItems: ["bandage", "healthkit", "soda", "painkiller"],
    seekerSpawnItems: { bandage: 10 },
    seekerAdrenalineHeals: false,
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
};

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
