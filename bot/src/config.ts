import { getConfig } from "../../config";

const isProd = process.env["NODE_ENV"] === "production";
export const serverConfigPath = isProd ? "../../" : "";
export const Config = getConfig(isProd, serverConfigPath);

// Report setting names only; never include credentials in startup errors.
const requiredSettings = {
    discordGuildId: Config.discordGuildId,
    discordRoleId: Config.discordRoleId,
    discordOwnerRoleId: Config.discordOwnerRoleId,
    "secrets.DISCORD_CLIENT_ID": Config.secrets.DISCORD_CLIENT_ID,
    "secrets.DISCORD_BOT_TOKEN": Config.secrets.DISCORD_BOT_TOKEN,
    "gameServer.apiServerUrl": Config.gameServer.apiServerUrl,
};
const missingSettings = Object.entries(requiredSettings)
    .filter(([, value]) => !value || (typeof value === "string" && !value.trim()))
    .map(([name]) => name);

if (missingSettings.length) {
    throw new Error(
        `Missing bot settings in survev-config.hjson: ${missingSettings.join(", ")}. ` +
            "Save the settings in the config file shown above, then restart the bot. " +
            "DISCORD_CLIENT_ID and DISCORD_BOT_TOKEN belong inside the secrets object.",
    );
}

const API_URL = `${Config.gameServer.apiServerUrl}/private`;

// All of these optional config values were validated above.
const DISCORD_GUILD_ID = Config.discordGuildId!;
const DISCORD_ROLE_ID = Config.discordRoleId!;
const DISCORD_OWNER_ROLE_ID = Config.discordOwnerRoleId!;
const DISCORD_CLIENT_ID = Config.secrets.DISCORD_CLIENT_ID!;
const DISCORD_BOT_TOKEN = Config.secrets.DISCORD_BOT_TOKEN!;

export {
    API_URL,
    DISCORD_BOT_TOKEN,
    DISCORD_CLIENT_ID,
    DISCORD_GUILD_ID,
    DISCORD_OWNER_ROLE_ID,
    DISCORD_ROLE_ID,
};
