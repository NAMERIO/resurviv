import {
    type ChatInputCommandInteraction,
    EmbedBuilder,
    escapeMarkdown,
    SlashCommandBuilder,
} from "discord.js";
import { botLogger, Command, honoClient, isAdmin } from "../utils";
import { sendNoPermissionMessage } from "./helpers";

type ModeSummary = {
    index: number;
    mapName: string;
    teamMode: number;
    teamModeLabel: string;
    enabled: boolean;
};

type ListGameModesResponse = {
    ok: true;
    battleRoyaleEnabled: boolean;
    deathmatchModes: ModeSummary[];
    battleRoyaleModes: ModeSummary[];
    availableDeathmatchMapIds: string[];
    availableBattleRoyaleMapIds: string[];
};

function formatModeSlot(mode: ModeSummary) {
    const status = mode.enabled ? "ON " : "OFF";
    return `\`${mode.index}\`  **${escapeMarkdown(mode.mapName)}**  ${status}  ${mode.teamModeLabel} (${mode.teamMode})`;
}

function formatModeList(modes: ModeSummary[]) {
    if (!modes.length) {
        return "_No configured indexes._";
    }
    return modes.map(formatModeSlot).join("\n");
}

function formatMapIds(mapIds: string[]) {
    if (!mapIds.length) {
        return "_None found._";
    }

    const ids = mapIds.map((mapId) => `\`${escapeMarkdown(mapId)}\``);
    const lines: string[] = [];
    let line = "";

    for (const id of ids) {
        const nextLine = line ? `${line}, ${id}` : id;
        if (nextLine.length > 900) {
            lines.push(line);
            line = id;
            continue;
        }
        line = nextLine;
    }

    if (line) {
        lines.push(line);
    }

    return lines.join("\n");
}

function buildListGameModesEmbed(result: ListGameModesResponse) {
    const activeDeathmatch = result.deathmatchModes.filter((mode) => mode.enabled).length;
    const activeBattleRoyale = result.battleRoyaleModes.filter(
        (mode) => mode.enabled,
    ).length;

    return new EmbedBuilder()
        .setTitle("Game Mode Configuration")
        .setColor(result.battleRoyaleEnabled ? 0x5fb3ff : 0x7d8794)
        .setDescription(
            [
                `Battle Royale global switch: **${result.battleRoyaleEnabled ? "ON" : "OFF"}**`,
                `Active slots: **${activeDeathmatch}** deathmatch, **${activeBattleRoyale}** battle royale`,
            ].join("\n"),
        )
        .addFields(
            {
                name: "Deathmatch Indexes",
                value: formatModeList(result.deathmatchModes),
                inline: false,
            },
            {
                name: "Battle Royale Indexes",
                value: formatModeList(result.battleRoyaleModes),
                inline: false,
            },
            {
                name: "Available Deathmatch Map IDs",
                value: formatMapIds(result.availableDeathmatchMapIds),
                inline: false,
            },
            {
                name: "Available Battle Royale Map IDs",
                value: formatMapIds(result.availableBattleRoyaleMapIds),
                inline: false,
            },
        )
        .setFooter({
            text: "Use /set_game_mode with one of the listed indexes and map ids.",
        })
        .setTimestamp();
}

export const listGameModesHandler = {
    command: new SlashCommandBuilder()
        .setName(Command.ListGameModes)
        .setDescription("List mode indexes and available map ids"),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!isAdmin(interaction)) {
            await sendNoPermissionMessage(interaction);
            return;
        }

        await interaction.deferReply();

        try {
            const res = await honoClient.list_game_modes.$post({
                json: {},
            });
            const result = (await res.json()) as ListGameModesResponse;

            await interaction.editReply({
                embeds: [buildListGameModesEmbed(result)],
            });
        } catch (error) {
            botLogger.error("Error in list_game_modes command:", error);
            await interaction.editReply({
                content: "An error occurred while loading game mode configuration.",
            });
        }
    },
};
