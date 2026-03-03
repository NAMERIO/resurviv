declare module "discord-rpc" {
    export interface Presence {
        details?: string;
        state?: string;
        startTimestamp?: Date | number;
        endTimestamp?: Date | number;
        largeImageKey?: string;
        largeImageText?: string;
        smallImageKey?: string;
        smallImageText?: string;
        partyId?: string;
        partySize?: number;
        partyMax?: number;
        matchSecret?: string;
        joinSecret?: string;
        spectateSecret?: string;
        instance?: boolean;
    }

    export interface ClientUser {
        id: string;
        username: string;
        discriminator: string;
        avatar: string;
    }

    export class Client {
        user: ClientUser | null;
        constructor(options: { transport: "ipc" | "websocket" });
        login(options: { clientId: string }): Promise<this>;
        setActivity(activity: Presence): Promise<void>;
        clearActivity(): Promise<void>;
        destroy(): Promise<void>;
        on(event: "ready", listener: () => void): this;
        on(event: "disconnected", listener: () => void): this;
        on(event: string, listener: (...args: unknown[]) => void): this;
    }

    export function register(clientId: string): void;

    const _default: {
        Client: typeof Client;
        register: typeof register;
    };
    export default _default;
}
