import { Discord, generateCodeVerifier, generateState } from "arctic";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { Config } from "../../../../config";
import {
    cookieDomain,
    type DiscordUserWithPrimaryGuild,
    getOAuthRedirect,
    getRedirectUri,
    handleAuthUser,
    syncDiscordServerTagReward,
} from "./authUtils";
import { beginNativeOAuth, finishNativeOAuth, readNativeOAuth } from "./native";

export const discord = new Discord(
    Config.secrets.DISCORD_CLIENT_ID!,
    Config.secrets.DISCORD_SECRET_ID!,
    getRedirectUri("discord"),
);

const stateCookieName = "discord_oauth_state";
const codeVerifierCookieName = "discord_code_verifier";
const linkAccountCookieName = "discord_oauth_link_account";

export const DiscordRouter = new Hono();

DiscordRouter.use(async (c, next) => {
    if (!(Config.secrets.DISCORD_CLIENT_ID && Config.secrets.DISCORD_SECRET_ID)) {
        return c.text("Discord login is not supported", 500);
    }
    await next();
});

DiscordRouter.get("/", async (c) => {
    await beginNativeOAuth(c, "discord");
    const state = generateState();
    const codeVerifier = generateCodeVerifier();
    const linkAccount = c.req.query("link") === "1";

    const url = discord.createAuthorizationURL(state, codeVerifier, [
        "identify",
        "email",
    ]);

    setCookie(c, stateCookieName, state, {
        path: "/",
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 60 * 10,
        sameSite: "Lax",
        domain: cookieDomain,
    });

    setCookie(c, codeVerifierCookieName, codeVerifier, {
        secure: process.env.NODE_ENV === "production",
        path: "/",
        httpOnly: false,
        maxAge: 60 * 10,
        sameSite: "Lax",
        domain: cookieDomain,
    });

    if (linkAccount) {
        setCookie(c, linkAccountCookieName, "1", {
            secure: process.env.NODE_ENV === "production",
            path: "/",
            httpOnly: true,
            maxAge: 60 * 10,
            sameSite: "Lax",
            domain: cookieDomain,
        });
    } else {
        deleteCookie(c, linkAccountCookieName, {
            path: "/",
            domain: cookieDomain,
        });
    }

    if (!c.req.query("native")) url.searchParams.append("prompt", "none");
    return c.redirect(url);
});

DiscordRouter.get("/callback", async (c) => {
    const code = c.req.query("code")?.toString() ?? null;
    const state = c.req.query("state")?.toString() ?? null;
    const storedState = getCookie(c)[stateCookieName] ?? null;
    const storedCodeVerifier = getCookie(c)[codeVerifierCookieName] ?? null;
    const linkAccount = getCookie(c)[linkAccountCookieName] === "1";
    deleteCookie(c, linkAccountCookieName, {
        path: "/",
        domain: cookieDomain,
    });

    if (!state || !storedCodeVerifier || !storedState || state !== storedState) {
        return c.json({}, 400);
    }

    deleteCookie(c, stateCookieName, { path: "/", domain: cookieDomain });
    deleteCookie(c, codeVerifierCookieName, { path: "/", domain: cookieDomain });
    const native = await readNativeOAuth(c, "discord");
    if (!code)
        return native
            ? finishNativeOAuth(c, native, { error: "login_cancelled" })
            : c.json({}, 400);
    try {
        const tokens = await discord.validateAuthorizationCode(code, storedCodeVerifier);

        const discordUserResponse = await fetch("https://discord.com/api/users/@me", {
            headers: {
                Authorization: `Bearer ${tokens.accessToken()}`,
            },
        });

        const resData = (await discordUserResponse.json()) as DiscordUserWithPrimaryGuild;

        if (!resData.verified) {
            if (native)
                return finishNativeOAuth(c, native, { error: "verified_email_required" });
            return c.json({ error: "verified_email_required" }, 400);
        }

        const result = await handleAuthUser(c, "discord", resData.id, {
            linkAccount: native ? !!native.request.linkSessionId : linkAccount,
            nativeSession: native ? { user: native.user } : undefined,
        });
        if (!result.error && result.user) {
            await syncDiscordServerTagReward(result.user, resData.id, resData);
        }

        if (native) return finishNativeOAuth(c, native, result);
        return c.redirect(getOAuthRedirect(result.error));
    } catch (error) {
        if (native) return finishNativeOAuth(c, native, { error: "login_failed" });
        throw error;
    }
});
