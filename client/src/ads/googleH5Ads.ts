type GoogleH5AdPlacementType =
    | "preroll"
    | "start"
    | "pause"
    | "next"
    | "browse"
    | "reward";

type GoogleH5AdConfig = {
    sound?: "on" | "off";
};

type GoogleH5AdBreakConfig = {
    type: GoogleH5AdPlacementType;
    name: string;
    beforeAd?: () => void;
    afterAd?: () => void;
    beforeReward?: (showAdFn: () => void) => void;
    adDismissed?: () => void;
    adViewed?: () => void;
    adBreakDone?: () => void;
};

function addCallback<T extends keyof GoogleH5AdBreakConfig>(
    config: GoogleH5AdBreakConfig,
    key: T,
    callback: GoogleH5AdBreakConfig[T],
) {
    if (typeof callback === "function") {
        config[key] = callback;
    }
}

declare global {
    interface Window {
        adsbygoogle?: unknown[];
        adBreak?: (config: GoogleH5AdBreakConfig) => void;
        adConfig?: (config: GoogleH5AdConfig) => void;
        H5_GAMES_ADS_ENABLED?: boolean;
        googleH5AdsScriptLoaded?: boolean;
    }
}

function isLocalHost() {
    return location.hostname === "localhost" || location.hostname === "127.0.0.1";
}

function isTestMode() {
    return new URLSearchParams(location.search).get("adbreak_test") === "on";
}

function isEnabled() {
    const testMode = isTestMode();
    return (
        H5_GAMES_ADS_ENABLED &&
        (!IS_DEV || testMode) &&
        (!isLocalHost() || testMode) &&
        window.googleH5AdsScriptLoaded === true &&
        typeof window.adBreak === "function"
    );
}

export const googleH5Ads = {
    enabled() {
        return H5_GAMES_ADS_ENABLED;
    },

    configureSound(muted: boolean) {
        if (!H5_GAMES_ADS_ENABLED) return;
        if (typeof window.adConfig !== "function") return;

        window.adConfig({
            sound: muted ? "off" : "on",
        });
    },

    requestInterstitial(
        type: Exclude<GoogleH5AdPlacementType, "reward" | "preroll">,
        name: string,
        callbacks: Pick<
            GoogleH5AdBreakConfig,
            "beforeAd" | "afterAd" | "adBreakDone"
        > = {},
    ) {
        if (!isEnabled()) {
            callbacks.adBreakDone?.();
            return;
        }

        const config: GoogleH5AdBreakConfig = {
            type,
            name,
        };
        addCallback(config, "beforeAd", callbacks.beforeAd);
        addCallback(config, "afterAd", callbacks.afterAd);
        addCallback(config, "adBreakDone", callbacks.adBreakDone);

        window.adBreak?.(config);
    },

    requestReward(
        name: string,
        callbacks: Pick<
            GoogleH5AdBreakConfig,
            "beforeAd" | "afterAd" | "adDismissed" | "adViewed" | "adBreakDone"
        >,
    ) {
        if (!isEnabled()) {
            callbacks.adBreakDone?.();
            return;
        }

        const config: GoogleH5AdBreakConfig = {
            type: "reward",
            name,
            beforeReward: (showAdFn) => showAdFn(),
        };
        addCallback(config, "beforeAd", callbacks.beforeAd);
        addCallback(config, "afterAd", callbacks.afterAd);
        addCallback(config, "adDismissed", callbacks.adDismissed);
        addCallback(config, "adViewed", callbacks.adViewed);
        addCallback(config, "adBreakDone", callbacks.adBreakDone);

        window.adBreak?.(config);
    },
};
