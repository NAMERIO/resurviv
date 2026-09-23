import { nativeApp } from "../../shared/nativeApp";
import { isNativeAndroid } from "./nativePlatform";
import { proxy } from "./proxy";

export const api = {
    resolveUrl(url: string) {
        if (isNativeAndroid() && url.startsWith("/api/"))
            return nativeApp.apiOrigin + url;
        const proxyDef = proxy.getProxyDef();
        if (proxyDef && proxyDef.def.apiUrl) {
            return proxyDef.def.apiUrl + url;
        }
        return url;
    },
    resolveRoomHost() {
        if (isNativeAndroid()) return new URL(nativeApp.apiOrigin).host;
        const proxyDef = proxy.getProxyDef();
        if (proxyDef && proxyDef.def.apiUrl) {
            return new URL(proxyDef.def.apiUrl).host;
        }
        return window.location.host;
    },
};
