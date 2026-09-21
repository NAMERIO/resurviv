import {
    type ChatInputCommandInteraction,
    escapeMarkdown,
    MessageFlags,
    SlashCommandBuilder,
} from "discord.js";
import type { CompetitiveBoard } from "../../../shared/types/competitive";
import { API_URL } from "../config";
import {
    Command,
    hasBotPermission,
    hasOwnerPermission,
    honoClient,
    isAdmin,
} from "../utils";
import { sendNoPermissionMessage } from "./helpers";

export { whrAddHandler } from "./whr-add";

import { readWhrResponse as readResponse } from "./whr-api";

async function staffAction(
    interaction: ChatInputCommandInteraction,
    run: () => Promise<string>,
    ownerOnly = false,
) {
    if (
        !hasBotPermission(interaction) ||
        (ownerOnly && !hasOwnerPermission(interaction) && !isAdmin(interaction))
    ) {
        await sendNoPermissionMessage(interaction);
        return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
        await interaction.editReply({
            content: (await run()).slice(0, 1900),
            allowedMentions: { parse: [] },
        });
    } catch (error) {
        await interaction.editReply({
            content: (error instanceof Error ? error.message : "Request failed.").slice(
                0,
                1900,
            ),
            allowedMentions: { parse: [] },
        });
    }
}

export const whrVoidHandler = {
    command: new SlashCommandBuilder()
        .setName(Command.WhrVoid)
        .setDescription(
            "Void a competitive result and rebuild its ratings (owner role only)",
        )
        .addStringOption((option) =>
            option
                .setName("match")
                .setDescription("Match ID from /whr_add or the website match history")
                .setRequired(true),
        )
        .addStringOption((option) =>
            option
                .setName("reason")
                .setDescription("Public reason for voiding the result")
                .setRequired(true)
                .setMinLength(3)
                .setMaxLength(300),
        ),
    async execute(interaction: ChatInputCommandInteraction) {
        if (!hasOwnerPermission(interaction)) {
            await sendNoPermissionMessage(interaction);
            return;
        }
        await staffAction(interaction, async () => {
            const result = await readResponse<{ message: string }>(
                await honoClient.competitive.void.$post({
                    json: {
                        matchId: interaction.options.getString("match", true),
                        executorId: interaction.user.id,
                        reason: interaction.options.getString("reason", true),
                    },
                }),
            );
            return result.message;
        });
    },
};

export const whrSeasonHandler = {
    command: new SlashCommandBuilder()
        .setName(Command.WhrSeason)
        .setDescription(
            "Start a fresh WHR season; preserves previous seasons (owner/admin)",
        )
        .addStringOption((option) =>
            option
                .setName("name")
                .setDescription("New season name")
                .setRequired(true)
                .setMaxLength(60),
        ),
    async execute(interaction: ChatInputCommandInteraction) {
        await staffAction(
            interaction,
            async () => {
                const season = await readResponse<{ id: number; name: string }>(
                    await honoClient.competitive.season.$post({
                        json: { name: interaction.options.getString("name", true) },
                    }),
                );
                return `Started **${escapeMarkdown(season.name)}** (season ${season.id}). New matches go here. Everyone begins provisional; previous seasons remain available.`;
            },
            true,
        );
    },
};

export const whrLeaderboardHandler = {
    command: new SlashCommandBuilder()
        .setName(Command.WhrLeaderboard)
        .setDescription("Show the competitive skill leaderboard")
        .addIntegerOption((option) =>
            option
                .setName("season")
                .setDescription(
                    "Season number, or -1 for the demo; defaults to the current season",
                )
                .setMinValue(-1),
        ),
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();
        try {
            const url = new URL(API_URL);
            url.pathname = "/api/competitive";
            const season = interaction.options.getInteger("season");
            if (season === 0) {
                await interaction.editReply({
                    content: "Use -1 for the demo or a season number of 1 or higher.",
                });
                return;
            }
            if (season !== null) url.searchParams.set("season", String(season));
            const board = await readResponse<CompetitiveBoard>(
                await fetch(url, { signal: AbortSignal.timeout(15000) }),
            );
            const lines = board.players
                .filter((player) => player.rank !== null)
                .slice(0, 10)
                .map(
                    (player) =>
                        `**#${player.rank}** ${escapeMarkdown(player.slug)} — **${player.rating.toLocaleString("en-US")}** (${player.games} matches)`,
                );
            await interaction.editReply({
                content: `**WHR · ${escapeMarkdown(board.season.name)}**\n${lines.join("\n") || `No ranked players yet. Play ${board.placementGames} rated matches to qualify.`}\nRatings may change as opponents play more matches.`,
                allowedMentions: { parse: [] },
            });
        } catch (error) {
            await interaction.editReply({
                content:
                    error instanceof Error
                        ? error.message.slice(0, 1900)
                        : "Could not load ratings.",
                allowedMentions: { parse: [] },
            });
        }
    },
};
