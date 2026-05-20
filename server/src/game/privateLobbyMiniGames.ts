import type { PrivateLobbyMiniGame } from "../../../shared/defs/miniGame";

export interface PrivateLobbyMiniGameWeaponOverride {
    primary?: string;
    secondary?: string;
}

interface PrivateLobbyMiniGameServerSettings {
    getWeaponOverride?: (
        arenaTeam: "A" | "B" | undefined,
    ) => PrivateLobbyMiniGameWeaponOverride | undefined;
}

export const PrivateLobbyMiniGameServerSettings: Record<
    PrivateLobbyMiniGame,
    PrivateLobbyMiniGameServerSettings
> = {
    pvp: {},
    hide_and_seek: {
        getWeaponOverride: (arenaTeam) =>
            arenaTeam === "A"
                ? {
                      primary: "prop_o_matic",
                      secondary: "",
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
