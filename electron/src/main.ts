import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, type IpcMainEvent, ipcMain } from "electron";
import { initAutoUpdater } from "./autoUpdater.js";
import {
    destroyDiscordRPC,
    initDiscordRPC,
    type PresenceData,
    setIdlePresence,
    updateMatchPresence,
} from "./discordRPC.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VITE_DEV_URL = process.env.VITE_DEV_URL || "http://127.0.0.1:3000";
const PROD_CLIENT_URL =
    process.env.RESURVIV_PROD_URL ||
    process.env.SURVEV_PROD_URL ||
    "https://resurviv.biz";
const IS_DEV = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        title: "Resurviv",
        icon: IS_DEV
            ? path.join(__dirname, "../assets/tree-01.png")
            : path.join(process.resourcesPath, "assets/tree-01.png"),
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    mainWindow.setMenuBarVisibility(false);

    if (IS_DEV) {
        mainWindow.loadURL(VITE_DEV_URL);
    } else {
        mainWindow.loadURL(PROD_CLIENT_URL);
    }

    mainWindow.on("closed", () => {
        mainWindow = null;
    });
}

function registerIPC(): void {
    ipcMain.on("discord:home", (_event: IpcMainEvent, playerName: string) => {
        setIdlePresence(playerName);
    });

    ipcMain.on("discord:match-start", (_event: IpcMainEvent, data: PresenceData) => {
        console.log("[IPC] match-start", data);
        updateMatchPresence(data);
    });

    ipcMain.on(
        "discord:match-update",
        (_event: IpcMainEvent, data: Partial<PresenceData>) => {
            console.log("[IPC] match-update", data);
            updateMatchPresence(data);
        },
    );

    ipcMain.on("discord:match-end", () => {
        console.log("[IPC] match-end");
        setIdlePresence();
    });
}

app.whenReady().then(async () => {
    createWindow();
    registerIPC();
    initAutoUpdater(() => mainWindow);

    await initDiscordRPC();

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on("window-all-closed", async () => {
    await destroyDiscordRPC();
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("before-quit", async () => {
    await destroyDiscordRPC();
});
