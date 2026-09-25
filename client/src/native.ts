import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { nativeApp } from "../../shared/nativeApp";
import { isNativeAndroid, isNativeIOS, isNativeMobile } from "./nativePlatform";

const pendingKey = "resurviv-native-oauth";
const ttl = 10 * 60 * 1000;
let openingLogin = false;
let exchanging = false;

function base64url(bytes: Uint8Array) {
    return btoa(String.fromCharCode(...bytes))
        .replaceAll("+", "-")
        .replaceAll("/", "_")
        .replaceAll("=", "");
}

export async function startNativeLogin(provider: "google" | "discord", link: boolean) {
    if (openingLogin) return;
    openingLogin = true;
    try {
        const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
        const challenge = base64url(
            new Uint8Array(
                await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
            ),
        );
        const response = await fetch(`${nativeApp.apiOrigin}/api/auth/native/request`, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
                "X-Requested-With": "XMLHttpRequest",
            },
            body: JSON.stringify({ provider, link, challenge }),
        });
        if (!response.ok) throw new Error("Unable to start sign-in. Please try again.");
        const { request } = await response.json();
        // Only a short-lived PKCE verifier is stored; never an OAuth token or session token.
        localStorage.setItem(
            pendingKey,
            JSON.stringify({ request, verifier, expires: Date.now() + ttl }),
        );
        await Browser.open({
            url: `${nativeApp.apiOrigin}/api/auth/${provider}?native=${encodeURIComponent(request)}`,
        });
    } finally {
        openingLogin = false;
    }
}

async function handleNativeReturn(raw: string, onLogin: () => void) {
    if (exchanging) return;
    let url: URL;
    try {
        url = new URL(raw);
    } catch {
        return;
    }
    if (`${url.protocol}//${url.host}${url.pathname}` !== nativeApp.callback) return;
    let pending: { request: string; verifier: string; expires: number };
    try {
        pending = JSON.parse(localStorage.getItem(pendingKey) || "null");
    } catch {
        return;
    }
    if (!pending || pending.expires < Date.now()) {
        localStorage.removeItem(pendingKey);
        return;
    }
    if (url.searchParams.get("request") !== pending.request) return;
    const code = url.searchParams.get("code");
    if (!code || !/^[A-Za-z0-9_-]{43}$/.test(code)) return;
    exchanging = true;
    try {
        const response = await fetch(`${nativeApp.apiOrigin}/api/auth/native/exchange`, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
                "X-Requested-With": "XMLHttpRequest",
            },
            body: JSON.stringify({
                request: pending.request,
                code,
                verifier: pending.verifier,
            }),
        });
        if (!response.ok)
            throw new Error(
                "Sign-in was cancelled or expired. Please try signing in again.",
            );
        localStorage.removeItem(pendingKey);
        // SFSafariViewController stays presented after a custom-scheme return on iOS.
        if (isNativeIOS()) {
            // On a cold start there is no browser view left to dismiss.
            await Browser.close().catch(() => {});
        }
        onLogin();
    } catch (error) {
        alert(
            error instanceof Error ? error.message : "Sign-in failed. Please try again.",
        );
    } finally {
        exchanging = false;
    }
}

export async function attachNativeApp(onBackInGame: () => boolean, onLogin: () => void) {
    if (!isNativeMobile()) return;
    if (isNativeAndroid()) {
        await App.addListener("backButton", () => {
            if (onBackInGame()) return;
            if (confirm("Exit Resurviv?")) void App.exitApp();
        });
    }
    await App.addListener("appUrlOpen", ({ url }) => {
        void handleNativeReturn(url, onLogin);
    });
    const launch = await App.getLaunchUrl();
    if (launch) await handleNativeReturn(launch.url, onLogin);

    const openExternal = (href: string) => {
        const url = new URL(href, nativeApp.apiOrigin);
        if (url.origin === nativeApp.origin) url.host = new URL(nativeApp.apiOrigin).host;
        if (url.protocol === "https:" || url.protocol === "http:") {
            void Browser.open({ url: url.href });
        }
    };
    document.addEventListener(
        "click",
        (event) => {
            const link = (event.target as Element | null)?.closest<HTMLAnchorElement>(
                "a[href]",
            );
            if (!link || link.hasAttribute("download")) return;
            const href = link.getAttribute("href");
            if (!href || href.startsWith("#") || href.startsWith("blob:")) return;
            event.preventDefault();
            openExternal(href);
        },
        true,
    );
    const originalOpen = window.open.bind(window);
    window.open = ((url?: string | URL, target?: string, features?: string) => {
        if (url && !String(url).startsWith("blob:")) {
            openExternal(String(url));
            return null;
        }
        return originalOpen(url, target, features);
    }) as typeof window.open;
}
