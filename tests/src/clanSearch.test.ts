import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { ClanInfo, ListClansResponse } from "../../shared/types/clan";

const mocks = vi.hoisted(() => {
    const elements = new Map<string, any>();
    const requests: any[] = [];
    const jquery = Object.assign(
        (selector: string) => {
            if (!elements.has(selector)) {
                const element = {
                    value: "",
                    val() {
                        return this.value;
                    },
                    attr: vi.fn().mockReturnThis(),
                    text: vi.fn().mockReturnThis(),
                    empty: vi.fn().mockReturnThis(),
                };
                elements.set(selector, element);
            }
            return elements.get(selector);
        },
        {
            ajax: vi.fn((options: any) => {
                let resolve: (value: unknown) => void;
                let reject: (value: unknown) => void;
                const request = {
                    options,
                    done(callback: typeof resolve) {
                        resolve = callback;
                        return this;
                    },
                    fail(callback: typeof reject) {
                        reject = callback;
                        return this;
                    },
                    abort: vi.fn(() => reject?.({ statusText: "abort" })),
                    resolve: (value: unknown) => resolve(value),
                    reject: () => reject({ status: 500 }),
                };
                requests.push(request);
                return request;
            }),
        },
    );
    return { jquery, elements, requests };
});

vi.mock("../../client/node_modules/jquery", () => ({ default: mocks.jquery }));
vi.mock("../../client/src/api", () => ({
    api: { resolveUrl: (url: string) => url },
}));

import { ClanUi } from "../../client/src/ui/clanUi";

let ui: ClanUi;

function typeSearch(value: string) {
    mocks.jquery("#clan-search-input").value = value;
    ui.scheduleClanSearch();
}

function results(name: string): ListClansResponse {
    return {
        clans: [{ name } as ClanInfo],
        totalCount: 1,
        page: 1,
        totalPages: 1,
        clansLocked: false,
    };
}

beforeEach(() => {
    vi.useFakeTimers();
    mocks.elements.clear();
    mocks.requests.length = 0;
    mocks.jquery.ajax.mockClear();
    ui = Object.assign(Object.create(ClanUi.prototype), {
        clanSearchTimer: null,
        clanListRequest: null,
        clanListRequestId: 0,
        updateClanJoinLockNotice: vi.fn(),
        updateCreateClanLockState: vi.fn(),
        renderClanList: vi.fn(),
    });
});

afterEach(() => {
    ui.cancelClanSearch();
    vi.useRealTimers();
});

test("typing a partial name searches automatically after typing pauses", () => {
    typeSearch("e");
    vi.advanceTimersByTime(100);
    typeSearch("el");
    vi.advanceTimersByTime(100);
    typeSearch("eli");
    vi.advanceTimersByTime(299);
    expect(mocks.jquery.ajax).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(mocks.requests).toHaveLength(1);
    expect(JSON.parse(mocks.requests[0].options.data)).toEqual({
        page: 1,
        limit: 20,
        search: "eli",
    });
    mocks.requests[0].resolve(results("Elite"));
    expect(ui.renderClanList).toHaveBeenCalledWith(results("Elite").clans, 1, 1);
    expect(mocks.jquery("#clan-search-status").text).toHaveBeenLastCalledWith(
        "1 matching clan",
    );
    expect(mocks.jquery("#clan-list-container").attr).toHaveBeenLastCalledWith(
        "aria-busy",
        "false",
    );
});

test("an older response cannot replace matches for the latest input", () => {
    typeSearch("e");
    vi.advanceTimersByTime(300);
    const older = mocks.requests[0];

    typeSearch("elite");
    expect(older.abort).toHaveBeenCalledOnce();
    older.resolve(results("Earlier clan"));
    expect(ui.renderClanList).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    mocks.requests[1].resolve(results("Elite"));
    older.resolve(results("Earlier clan"));
    expect(ui.renderClanList).toHaveBeenCalledOnce();
    expect(ui.renderClanList).toHaveBeenLastCalledWith(results("Elite").clans, 1, 1);
});

test("submitting a search immediately cancels its pending delayed request", () => {
    typeSearch("elite");
    ui.loadClanList(1);
    vi.advanceTimersByTime(1000);
    expect(mocks.requests).toHaveLength(1);
});

test("clearing the name restores the clan list and preserves the region filter", () => {
    mocks.jquery("#clan-region-filter").value = "na";
    typeSearch("elite");
    vi.advanceTimersByTime(300);
    typeSearch("");
    vi.advanceTimersByTime(300);
    expect(JSON.parse(mocks.requests[1].options.data)).toEqual({
        page: 1,
        limit: 20,
        region: "na",
    });
});

test("closing the hub cancels pending searches and ignores in-flight results", () => {
    typeSearch("elite");
    ui.cancelClanSearch();
    vi.advanceTimersByTime(1000);
    expect(mocks.requests).toHaveLength(0);

    ui.loadClanList(1);
    ui.cancelClanSearch();
    mocks.requests[0].resolve(results("Elite"));
    expect(mocks.requests[0].abort).toHaveBeenCalledOnce();
    expect(ui.renderClanList).not.toHaveBeenCalled();
});

test("failed searches clear stale matches and can be retried", () => {
    typeSearch("elite");
    vi.advanceTimersByTime(300);
    mocks.requests[0].reject();
    expect(mocks.jquery("#clan-list-container").empty).toHaveBeenCalledOnce();
    expect(mocks.jquery("#clan-search-status").text).toHaveBeenLastCalledWith(
        "Couldn't load clans. Try again.",
    );

    ui.loadClanList(1);
    mocks.requests[1].resolve(results("Elite"));
    expect(ui.renderClanList).toHaveBeenCalledWith(results("Elite").clans, 1, 1);
});
