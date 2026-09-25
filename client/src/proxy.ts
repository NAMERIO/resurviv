import { nativeApp } from "../../shared/nativeApp";
import type { ProxyDef } from "../../shared/types/api";
import { isNativeAndroid, isNativeMobile, nativeClientConfig } from "./nativePlatform";

declare const PROXY_DEFS: Record<string, ProxyDef>;

export const proxy = {
    getProxyDef() {
        if (isNativeMobile())
            return {
                proxy: isNativeAndroid() ? "android" : "ios",
                def: {
                    apiUrl: nativeApp.apiOrigin,
                    google: nativeClientConfig?.google ?? true,
                    discord: nativeClientConfig?.discord ?? true,
                } as ProxyDef,
            };
        for (const proxy in PROXY_DEFS) {
            if (window.location.hostname.indexOf(proxy) !== -1) {
                return { proxy: proxy, def: PROXY_DEFS[proxy] };
            }
        }

        if (PROXY_DEFS.default) {
            return {
                proxy: window.location.hostname,
                def: PROXY_DEFS.default,
            };
        }

        return null;
    },

    loginSupported(loginType: keyof ProxyDef) {
        const proxyDef = proxy.getProxyDef();
        return proxyDef ? !!(proxyDef.def[loginType] || proxyDef.def.all) : false;
    },

    anyLoginSupported() {
        return (
            proxy.loginSupported("google") ||
            proxy.loginSupported("discord") ||
            proxy.loginSupported("mock")
        );
    },
};
