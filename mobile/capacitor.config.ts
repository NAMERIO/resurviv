import type { CapacitorConfig } from "@capacitor/cli";
import { nativeApp } from "../shared/nativeApp";

const config: CapacitorConfig = {
    appId: "biz.resurviv.app",
    appName: "Resurviv",
    webDir: "../client/dist",
    server: {
        url: nativeApp.apiOrigin,
        hostname: "app.resurviv.biz",
        androidScheme: "https",
        cleartext: false,
        errorPath: "android-offline.html",
    },
    android: { allowMixedContent: false, webContentsDebuggingEnabled: false },
};
export default config;
