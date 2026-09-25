import { expect, test, vi } from "vitest";

const capacitor = vi.hoisted(() => ({
    isNativePlatform: vi.fn(),
    getPlatform: vi.fn(),
}));

vi.mock("../../client/node_modules/@capacitor/core", () => ({ Capacitor: capacitor }));

import {
    isNativeAndroid,
    isNativeIOS,
    isNativeMobile,
} from "../../client/src/nativePlatform";

test.each([
    ["android", true, true, false, true],
    ["ios", true, false, true, true],
    ["web", false, false, false, false],
    ["ios", false, false, false, false],
])("%s native=%s uses the expected native handlers", (platform, native, android, ios, mobile) => {
    capacitor.getPlatform.mockReturnValue(platform);
    capacitor.isNativePlatform.mockReturnValue(native);
    expect(isNativeAndroid()).toBe(android);
    expect(isNativeIOS()).toBe(ios);
    expect(isNativeMobile()).toBe(mobile);
});
