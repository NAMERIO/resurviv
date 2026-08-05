import { app, type BrowserWindow, dialog } from "electron";
import electronUpdater from "electron-updater";

const { autoUpdater } = electronUpdater;

let updatePromptOpen = false;

export function initAutoUpdater(getMainWindow: () => BrowserWindow | null): void {
    if (!app.isPackaged) return;

    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on("error", (error) => {
        console.error("[Auto Update] Update failed", error);
    });

    autoUpdater.on("update-available", (info) => {
        console.log(`[Auto Update] Downloading Resurviv ${info.version}`);
    });

    autoUpdater.on("update-not-available", () => {
        console.log("[Auto Update] Resurviv is up to date");
    });

    autoUpdater.on("update-downloaded", async (info) => {
        if (updatePromptOpen) return;
        updatePromptOpen = true;

        const options = {
            type: "info" as const,
            title: "Resurviv update ready",
            message: `Resurviv ${info.version} has been downloaded.`,
            detail: "Restart now to install the update.",
            buttons: ["Restart Now", "Later"],
            defaultId: 0,
            cancelId: 1,
            noLink: true,
        };
        const window = getMainWindow();
        const result = window
            ? await dialog.showMessageBox(window, options)
            : await dialog.showMessageBox(options);

        updatePromptOpen = false;
        if (result.response === 0) {
            autoUpdater.quitAndInstall(false, true);
        }
    });

    const checkForUpdates = () => {
        autoUpdater.checkForUpdates().catch((error: unknown) => {
            console.error("[Auto Update] Could not check for updates", error);
        });
    };

    setTimeout(checkForUpdates, 10_000);
}
