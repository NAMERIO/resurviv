import type { PrivateLobbyMiniGame } from "../../../shared/defs/miniGame";

export interface PrivateLobbyMiniGameWeaponOverride {
    primary?: string;
    secondary?: string;
}

export interface HideAndSeekSettings {
    hiderTeam: "A";
    seekerTeam: "B";
    hiderPrimaryWeapon: string;
    hiderSecondaryWeapon: string;
    propSwitchLimit: number;
    seekerBlindDuration: number;
    seekerBlindRadius: number;
    seekerBlindZoom: number;
    seekerWrongPropDamage: number;
    seekerWrongPropDamageCooldown: number;
    hiderNoiseInterval: number;
    hiderNoisePing: string;
    hiderNoisePingOffsetRadius: number;
    hiderNoiseWeapon: string;
    hiderNoiseShotAlt: boolean;
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
    propSwitchLimit: 5,
    seekerBlindDuration: 5,
    seekerBlindRadius: 20,
    seekerBlindZoom: 2,
    seekerWrongPropDamage: 10,
    seekerWrongPropDamageCooldown: 0.5,
    hiderNoiseInterval: 5,
    hiderNoisePing: "ping_hide_and_seek_noise",
    hiderNoisePingOffsetRadius: 16,
    hiderNoiseWeapon: "bugle",
    hiderNoiseShotAlt: false,
};

export const PrivateLobbyMiniGameServerSettings: Record<
    PrivateLobbyMiniGame,
    PrivateLobbyMiniGameServerSettings
> = {
    pvp: {},
    hide_and_seek: {
        hideAndSeek: HideAndSeekSettings,
        getWeaponOverride: (arenaTeam) =>
            arenaTeam === HideAndSeekSettings.hiderTeam
                ? {
                      primary: HideAndSeekSettings.hiderPrimaryWeapon,
                      secondary: HideAndSeekSettings.hiderSecondaryWeapon,
                  }
                : undefined,
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
