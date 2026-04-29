const localBanKey = "resurviv_local_ban";
const localBanCookie = "resurviv_local_ban";

export interface LocalBan {
    reason: string;
    permanent: boolean;
    expiresIn: string;
}

function getCookieValue(name: string) {
    const prefix = `${name}=`;
    const parts = document.cookie.split("; ");
    for (const part of parts) {
        if (part.startsWith(prefix)) {
            return decodeURIComponent(part.slice(prefix.length));
        }
    }
    return "";
}

function writeCookie(value: string, expiresIn: string) {
    document.cookie = `${localBanCookie}=${encodeURIComponent(
        value,
    )}; expires=${new Date(expiresIn).toUTCString()}; path=/; SameSite=Lax`;
}

export function setLocalBan(
    reason = "Banned",
    permanent = false,
    expiresIn = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
) {
    const ban: LocalBan = {
        reason,
        permanent,
        expiresIn,
    };
    const value = JSON.stringify(ban);
    localStorage.setItem(localBanKey, value);
    writeCookie(value, expiresIn);
}

export function clearLocalBan() {
    localStorage.removeItem(localBanKey);
    document.cookie = `${localBanCookie}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
}

export function getLocalBan() {
    const raw = localStorage.getItem(localBanKey) || getCookieValue(localBanCookie);
    if (!raw) return null;

    try {
        const ban = JSON.parse(raw) as LocalBan;
        if (!ban.permanent && new Date(ban.expiresIn).getTime() <= Date.now()) {
            clearLocalBan();
            return null;
        }
        return ban;
    } catch {
        clearLocalBan();
        return null;
    }
}
