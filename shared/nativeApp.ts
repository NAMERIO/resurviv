// Public application identifiers only. Never put OAuth credentials here.
export const nativeApp = {
    // Keep the bundled app's origin valid for players on the first Android release.
    origin: "https://app.resurviv.biz",
    apiOrigin: "https://resurviv.biz",
    callback: "biz.resurviv.app://oauth/callback",
} as const;

export function isNativeAppOrigin(origin: string | undefined) {
    return origin === nativeApp.origin || origin === nativeApp.apiOrigin;
}

export interface NativeClientConfig {
    regions: Record<string, { address: string; https: boolean; l10n: string }>;
    google: boolean;
    discord: boolean;
}
