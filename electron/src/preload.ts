const { contextBridge, ipcRenderer } = require("electron") as typeof import("electron");

interface RendererPresenceData {
    region?: string;
    kills?: number;
    gameMode?: string;
    playersAlive?: number;
    playersTotal?: number;
}

contextBridge.exposeInMainWorld("discordRPC", {
    setHome(playerName: string) {
        ipcRenderer.send("discord:home", playerName);
    },

    matchStart(data: RendererPresenceData) {
        ipcRenderer.send("discord:match-start", data);
    },

    matchUpdate(data: Partial<RendererPresenceData>) {
        ipcRenderer.send("discord:match-update", data);
    },

    matchEnd() {
        ipcRenderer.send("discord:match-end");
    },

    isElectron: true as const,
});

// Keep Rich Presence in sync even when the production web client is older or
// has been served from a stale browser/CDN cache. These values come from the
// same DOM elements the game uses to display the signed-in name and screen.
let lastPlayerName = "";
let wasOnHomeScreen: boolean | undefined;

function elementIsVisible(element: HTMLElement | null): boolean {
    return !!element && window.getComputedStyle(element).display !== "none";
}

function syncDisplayedPlayerName(force = false): void {
    const accountNameElement = document.getElementById("account-player-name");
    const accountName = elementIsVisible(accountNameElement)
        ? accountNameElement!.textContent?.trim()
        : "";
    const nameInput = document.getElementById(
        "player-name-input-solo",
    ) as HTMLInputElement | null;
    const displayedName = accountName || nameInput?.value.trim() || "";

    if (displayedName && (force || displayedName !== lastPlayerName)) {
        lastPlayerName = displayedName;
        ipcRenderer.send("discord:home", displayedName);
    }
}

function syncCurrentScreen(): void {
    const startMenu = document.getElementById("start-menu-wrapper");
    const gameArea = document.getElementById("game-area-wrapper");
    const isOnHomeScreen = elementIsVisible(startMenu) && !elementIsVisible(gameArea);

    if (isOnHomeScreen && wasOnHomeScreen !== true) {
        ipcRenderer.send("discord:match-end");
    } else if (!isOnHomeScreen && wasOnHomeScreen === true) {
        // Re-assert the visible account name at match start. This prevents a
        // stale guest-name update from replacing a signed-in username.
        syncDisplayedPlayerName(true);
    }
    wasOnHomeScreen = isOnHomeScreen;
}

function installPresenceFallbacks(): void {
    const desktopDownloads = document.getElementById("desktop-downloads");
    if (desktopDownloads) desktopDownloads.style.display = "none";

    syncDisplayedPlayerName();
    syncCurrentScreen();

    const observer = new MutationObserver(() => {
        syncDisplayedPlayerName();
        syncCurrentScreen();
    });
    observer.observe(document.body, {
        attributes: true,
        childList: true,
        characterData: true,
        subtree: true,
    });

    document.addEventListener(
        "input",
        (event) => {
            if ((event.target as Element | null)?.id === "player-name-input-solo") {
                syncDisplayedPlayerName();
            }
        },
        true,
    );

    // Run before the game's click handler so Discord leaves the match as soon
    // as the player confirms Quit from the pause or spectating menu.
    document.addEventListener(
        "click",
        (event) => {
            const target = event.target as Element | null;
            if (target?.closest("#btn-game-quit, #btn-spectate-quit")) {
                ipcRenderer.send("discord:match-end");
            }
        },
        true,
    );
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installPresenceFallbacks, {
        once: true,
    });
} else {
    installPresenceFallbacks();
}
