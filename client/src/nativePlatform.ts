import { Capacitor } from "@capacitor/core";
import { type NativeClientConfig, nativeApp } from "../../shared/nativeApp";

export const isNativeAndroid = () =>
    Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";

export let nativeClientConfig: NativeClientConfig | undefined;

export async function prepareNativeClient() {
    if (!isNativeAndroid()) return;
    // Read only the public settings exposed by the production API, never local server config.
    for (;;) {
        try {
            const response = await fetch(`${nativeApp.apiOrigin}/api/mobile/config`, {
                signal: AbortSignal.timeout(15000),
            });
            if (!response.ok) throw new Error("Mobile configuration unavailable");
            const config: NativeClientConfig = await response.json();
            if (!config.regions || Object.keys(config.regions).length === 0) {
                throw new Error("No production regions configured");
            }
            for (const region of Object.values(config.regions)) {
                const url = new URL(`https://${region.address}`);
                if (
                    !region.https ||
                    /^(localhost|127\.|0\.|\[::1\])/.test(url.hostname)
                ) {
                    throw new Error("Android requires public HTTPS game regions");
                }
            }
            nativeClientConfig = config;
            return;
        } catch {
            await new Promise<void>((resolve) => {
                const panel = document.createElement("div");
                panel.style.cssText =
                    "position:fixed;inset:0;z-index:2147483647;background:#162019;color:white;display:grid;place-content:center;gap:20px;padding:30px;text-align:center;font:18px sans-serif";
                const message = document.createElement("p");
                message.textContent =
                    "Resurviv could not connect. Check your internet connection and try again.";
                const retry = document.createElement("button");
                retry.textContent = "Retry";
                retry.onclick = () => {
                    panel.remove();
                    resolve();
                };
                panel.append(message, retry);
                document.body.append(panel);
            });
        }
    }
}
