import { beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    begin: vi.fn(),
    read: vi.fn(),
    finish: vi.fn(),
    handle: vi.fn(),
    reward: vi.fn(),
    tokens: vi.fn(),
}));
vi.mock("../../server/src/config", () => ({
    Config: {
        secrets: {
            GOOGLE_CLIENT_ID: "test",
            GOOGLE_SECRET_ID: "test",
            DISCORD_CLIENT_ID: "test",
            DISCORD_SECRET_ID: "test",
        },
    },
}));
vi.mock("../../server/node_modules/arctic", () => {
    class Provider {
        createAuthorizationURL() {
            return new URL("https://provider.example/authorize");
        }
        validateAuthorizationCode = mocks.tokens;
    }
    return {
        Google: Provider,
        Discord: Provider,
        generateState: () => "state",
        generateCodeVerifier: () => "verifier",
    };
});
vi.mock("../../server/src/api/routes/user/auth/native", () => ({
    beginNativeOAuth: mocks.begin,
    readNativeOAuth: mocks.read,
    finishNativeOAuth: mocks.finish,
}));
vi.mock("../../server/src/api/routes/user/auth/authUtils", () => ({
    cookieDomain: undefined,
    getRedirectUri: () => "https://resurviv.biz/api/auth/callback",
    getOAuthRedirect: () => "https://resurviv.biz/",
    handleAuthUser: mocks.handle,
    syncDiscordServerTagReward: mocks.reward,
}));

import { DiscordRouter } from "../../server/src/api/routes/user/auth/discord";
import { GoogleRouter } from "../../server/src/api/routes/user/auth/google";

beforeEach(() => {
    vi.clearAllMocks();
    mocks.begin.mockResolvedValue(undefined);
    mocks.read.mockResolvedValue({
        request: { id: "request", linkSessionId: null },
        user: null,
    });
    mocks.handle.mockResolvedValue({ user: { id: "player" } });
    mocks.finish.mockImplementation((c) =>
        c.redirect("biz.resurviv.app://oauth/callback?request=request"),
    );
    mocks.reward.mockResolvedValue(undefined);
    mocks.tokens.mockResolvedValue({ accessToken: () => "test-token" });
    vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
            json: () =>
                Promise.resolve({
                    sub: "google-id",
                    id: "discord-id",
                    email_verified: true,
                    verified: true,
                }),
        }),
    );
});

for (const [provider, router] of [
    ["google", GoogleRouter],
    ["discord", DiscordRouter],
] as const) {
    const cookie = `${provider}_oauth_state=state; ${provider}_code_verifier=verifier; ${provider}_oauth_link_account=1; session=different-browser-session`;
    const callback = (query = "code=code&state=state") =>
        router.request(`http://api.test/callback?${query}`, {
            headers: { Cookie: cookie },
        });

    test(`${provider}: native sign-in overrides the unrelated browser session/link flag`, async () => {
        const response = await callback();
        expect(response.headers.get("Location")).toBe(
            "biz.resurviv.app://oauth/callback?request=request",
        );
        expect(mocks.handle).toHaveBeenCalledWith(
            expect.anything(),
            provider,
            `${provider}-id`,
            { linkAccount: false, nativeSession: { user: null } },
        );
    });

    test(`${provider}: linking passes only the app-session owner to existing authentication`, async () => {
        const user = { id: "app-owner" };
        mocks.read.mockResolvedValue({
            request: { id: "request", linkSessionId: "app-session" },
            user,
        });
        await callback();
        expect(mocks.handle).toHaveBeenCalledWith(
            expect.anything(),
            provider,
            `${provider}-id`,
            { linkAccount: true, nativeSession: { user } },
        );
    });

    test(`${provider}: invalid provider state cannot complete a native request`, async () => {
        expect((await callback("code=code&state=wrong")).status).toBe(400);
        expect(mocks.read).not.toHaveBeenCalled();
        expect(mocks.handle).not.toHaveBeenCalled();
        expect(mocks.finish).not.toHaveBeenCalled();
    });

    test(`${provider}: provider cancellation returns safely without creating a session`, async () => {
        expect((await callback("error=access_denied&state=state")).status).toBe(302);
        expect(mocks.finish).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
            error: "login_cancelled",
        });
        expect(mocks.handle).not.toHaveBeenCalled();
    });

    test(`${provider}: token failure returns an error handoff`, async () => {
        mocks.tokens.mockRejectedValue(new Error("Provider rejected the code"));
        expect((await callback()).status).toBe(302);
        expect(mocks.finish).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
            error: "login_failed",
        });
        expect(mocks.handle).not.toHaveBeenCalled();
    });

    test(`${provider}: ordinary web login still uses its existing session and redirect`, async () => {
        mocks.read.mockResolvedValue(undefined);
        const response = await callback();
        expect(response.headers.get("Location")).toBe("https://resurviv.biz/");
        expect(mocks.handle).toHaveBeenCalledWith(
            expect.anything(),
            provider,
            `${provider}-id`,
            { linkAccount: true, nativeSession: undefined },
        );
        expect(mocks.finish).not.toHaveBeenCalled();
    });
}

test("new Discord Android users can consent instead of being forced into prompt=none", async () => {
    const native = await DiscordRouter.request("http://api.test/?native=request");
    expect(new URL(native.headers.get("Location")!).searchParams.has("prompt")).toBe(
        false,
    );
    const web = await DiscordRouter.request("http://api.test/");
    expect(new URL(web.headers.get("Location")!).searchParams.get("prompt")).toBe("none");
});
