import type { WebSocket } from "uWebSockets.js";
import type { FindGamePrivateBody, GameData, GameSocketData } from "../utils/types";

export abstract class GameManager {
    abstract sockets: Map<string, WebSocket<GameSocketData>>;

    abstract getPlayerCount(): number;

    abstract getById(id: string): GameData | undefined;

    abstract findGame(body: FindGamePrivateBody): Promise<string>;

    abstract kickPlayerByIP(encodedIp: string): void;

    abstract onOpen(socketId: string, socket: WebSocket<GameSocketData>): void;

    abstract onMsg(socketId: string, msg: ArrayBuffer): void;

    abstract onClose(socketId: string): void;
}
