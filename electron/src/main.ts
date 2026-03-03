import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, ipcMain, type IpcMainEvent } from "electron";
import {
    destroyDiscordRPC,
    initDiscordRPC,
    setIdlePresence,
    updateMatchPresence,
    type PresenceData,
} from "./discordRPC.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VITE_DEV_URL = process.env.VITE_DEV_URL || "http://127.0.0.1:3000";
const PROD_CLIENT_PATH = path.join(__dirname, "../../client/dist/index.html");
const IS_DEV = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        title: "Survev",
        icon: path.join(__dirname, "../../client/public/img/favicon.png"),
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
        mainWindow.loadFile(PROD_CLIENT_PATH);
    }

    mainWindow.on("closed", () => {
        mainWindow = null;
    });
}

function registerIPC(): void {
    ipcMain.on("discord:match-start", (_event: IpcMainEvent, data: PresenceData) => {
        console.log("[IPC] match-start", data);
        updateMatchPresence({
            ...data,
            matchStartTimestamp: data.matchStartTimestamp ?? Date.now(),
        });
    });

    ipcMain.on("discord:match-update", (_event: IpcMainEvent, data: Partial<PresenceData>) => {
        console.log("[IPC] match-update", data);
        updateMatchPresence(data);
    });

    ipcMain.on("discord:match-end", () => {
        console.log("[IPC] match-end");
        setIdlePresence();
    });
}

app.whenReady().then(async () => {
    createWindow();
    registerIPC();

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
