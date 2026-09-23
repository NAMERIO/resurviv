import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
    appId: "biz.resurviv.app",
    appName: "Resurviv",
    webDir: "../client/dist",
    // A virtual, same-site origin for bundled assets; this is not a remote server URL.
    server: { hostname: "app.resurviv.biz", androidScheme: "https", cleartext: false },
    android: { allowMixedContent: false, webContentsDebuggingEnabled: false },
};
export default config;
