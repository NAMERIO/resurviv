// Public application identifiers only. Never put OAuth credentials here.
export const nativeApp = {
    origin: "https://app.resurviv.biz",
    apiOrigin: "https://resurviv.biz",
    callback: "biz.resurviv.app://oauth/callback",
} as const;

export interface NativeClientConfig {
    regions: Record<string, { address: string; https: boolean; l10n: string }>;
    google: boolean;
    discord: boolean;
}
