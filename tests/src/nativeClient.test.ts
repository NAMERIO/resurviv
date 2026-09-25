import { beforeEach, expect, test, vi } from "vitest";
import { nativeApp } from "../../shared/nativeApp";

const mocks = vi.hoisted(() => ({
    listeners: {} as Record<string, (...args: any[]) => any>,
    open: vi.fn(),
    close: vi.fn(),
    exit: vi.fn(),
    launch: vi.fn(),
    native: vi.fn(),
    ios: vi.fn(),
}));
vi.mock("../../client/node_modules/@capacitor/app", () => ({
    App: {
        addListener: (name: string, listener: (...args: any[]) => any) => {
            mocks.listeners[name] = listener;
            return Promise.resolve();
        },
        getLaunchUrl: mocks.launch,
        exitApp: mocks.exit,
    },
}));
vi.mock("../../client/node_modules/@capacitor/browser", () => ({
    Browser: { open: mocks.open, close: mocks.close },
}));
vi.mock("../../client/src/nativePlatform", () => ({
    isNativeMobile: mocks.native,
    isNativeAndroid: () => mocks.native() && !mocks.ios(),
    isNativeIOS: mocks.ios,
}));

import { attachNativeApp, startNativeLogin } from "../../client/src/native";

const storage = new Map<string, string>();
const request = "r".repeat(43);
const code = "c".repeat(43);
const fetchMock = vi.fn();

beforeEach(() => {
    vi.clearAllMocks();
    storage.clear();
    mocks.listeners = {};
    mocks.native.mockReturnValue(true);
    mocks.ios.mockReturnValue(false);
    mocks.close.mockResolvedValue(undefined);
    mocks.launch.mockResolvedValue(undefined);
    mocks.open.mockResolvedValue(undefined);
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ request }) });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("localStorage", {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
    });
    vi.stubGlobal("window", { open: vi.fn() });
    vi.stubGlobal("document", { addEventListener: vi.fn() });
    vi.stubGlobal(
        "confirm",
        vi.fn(() => false),
    );
    vi.stubGlobal("alert", vi.fn());
});

test("OAuth opens the HTTPS system browser and keeps the verifier out of the URL", async () => {
    await startNativeLogin("google", false);
    const [endpoint, options] = fetchMock.mock.calls[0];
    expect(endpoint).toBe(`${nativeApp.apiOrigin}/api/auth/native/request`);
    expect(options.credentials).toBe("include");
    expect(JSON.parse(options.body)).toMatchObject({
        provider: "google",
        link: false,
        challenge: expect.stringMatching(/^[\w-]{43}$/),
    });
    const pending = JSON.parse(storage.get("resurviv-native-oauth")!);
    expect(pending.verifier).toMatch(/^[\w-]{43}$/);
    expect(mocks.open).toHaveBeenCalledWith({
        url: `${nativeApp.apiOrigin}/api/auth/google?native=${request}`,
    });
    expect(JSON.stringify(mocks.open.mock.calls)).not.toContain(pending.verifier);
});

test("a cold-start return exchanges only the saved matching request and refreshes login", async () => {
    await startNativeLogin("discord", true);
    const pending = JSON.parse(storage.get("resurviv-native-oauth")!);
    mocks.launch.mockResolvedValue({
        url: `${nativeApp.callback}?request=${request}&code=${code}`,
    });
    const loggedIn = vi.fn();
    await attachNativeApp(() => false, loggedIn);
    expect(fetchMock).toHaveBeenLastCalledWith(
        `${nativeApp.apiOrigin}/api/auth/native/exchange`,
        expect.objectContaining({
            credentials: "include",
            body: JSON.stringify({ request, code, verifier: pending.verifier }),
        }),
    );
    expect(loggedIn).toHaveBeenCalledOnce();
    expect(mocks.close).not.toHaveBeenCalled();
    expect(storage.size).toBe(0);
});

test.each([
    "not a URL",
    "biz.resurviv.app://wrong/callback",
    `${nativeApp.callback}?request=wrong`,
    `${nativeApp.callback}?request=${request}`,
    "https://evil.example/oauth/callback",
])("ignores unsolicited return %s", async (url) => {
    await startNativeLogin("google", false);
    mocks.launch.mockResolvedValue({ url });
    const loggedIn = vi.fn();
    await attachNativeApp(() => false, loggedIn);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(loggedIn).not.toHaveBeenCalled();
});

test("expired client handoffs cannot sign in", async () => {
    storage.set(
        "resurviv-native-oauth",
        JSON.stringify({ request, verifier: "v".repeat(43), expires: 0 }),
    );
    mocks.launch.mockResolvedValue({
        url: `${nativeApp.callback}?request=${request}&code=${code}`,
    });
    await attachNativeApp(() => false, vi.fn());
    expect(fetchMock).not.toHaveBeenCalled();
    expect(storage.size).toBe(0);
});

test("Android back opens the game menu without asking to exit", async () => {
    const backInGame = vi.fn(() => true);
    await attachNativeApp(backInGame, vi.fn());
    mocks.listeners.backButton();
    expect(backInGame).toHaveBeenCalledOnce();
    expect(confirm).not.toHaveBeenCalled();
    expect(mocks.exit).not.toHaveBeenCalled();
});

test("exiting from the lobby requires confirmation", async () => {
    await attachNativeApp(() => false, vi.fn());
    mocks.listeners.backButton();
    expect(mocks.exit).not.toHaveBeenCalled();
    vi.mocked(confirm).mockReturnValue(true);
    mocks.listeners.backButton();
    expect(mocks.exit).toHaveBeenCalledOnce();
});

test("ordinary web startup does not install native handlers", async () => {
    mocks.native.mockReturnValue(false);
    const originalOpen = window.open;
    await attachNativeApp(() => false, vi.fn());
    expect(mocks.listeners).toEqual({});
    expect(window.open).toBe(originalOpen);
    expect(document.addEventListener).not.toHaveBeenCalled();
});

test.each([
    "cold",
    "warm",
])("iOS %s return closes the browser and never installs Android Back", async (start) => {
    mocks.ios.mockReturnValue(true);
    await startNativeLogin("google", false);
    const result = { url: `${nativeApp.callback}?request=${request}&code=${code}` };
    if (start === "cold") {
        mocks.launch.mockResolvedValue(result);
        mocks.close.mockRejectedValue(new Error("No active window to close!"));
    }
    const loggedIn = vi.fn();
    await attachNativeApp(() => false, loggedIn);
    if (start === "warm") {
        mocks.listeners.appUrlOpen(result);
        await vi.waitFor(() => expect(loggedIn).toHaveBeenCalledOnce());
    }
    expect(loggedIn).toHaveBeenCalledOnce();
    expect(mocks.close).toHaveBeenCalledOnce();
    expect(mocks.listeners.backButton).toBeUndefined();
    expect(mocks.exit).not.toHaveBeenCalled();
});

test("relative links and scripted external links use the production system browser", async () => {
    await attachNativeApp(() => false, vi.fn());
    window.open("/privacy.html");
    expect(mocks.open).toHaveBeenCalledWith({ url: "https://resurviv.biz/privacy.html" });
    window.open("https://discord.gg/Tm2Rmp9aFR");
    expect(mocks.open).toHaveBeenLastCalledWith({ url: "https://discord.gg/Tm2Rmp9aFR" });
});
