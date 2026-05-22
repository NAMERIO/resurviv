import {
    type ChatInputCommandInteraction,
    EmbedBuilder,
    SlashCommandBuilder,
} from "discord.js";
import { botLogger, Command, honoClient } from "../utils";

type GpLeaderboardResponse = {
    ok: true;
    players: {
        slug: string;
        username: string;
        gpBalance: number;
    }[];
};

function formatGp(value: number) {
    return value.toLocaleString("en-US");
}

function displayAccountName(player: { username: string; slug: string }) {
    return player.username || player.slug;
}

export const gpLeaderboardHandler = {
    command: new SlashCommandBuilder()
        .setName(Command.GpLeaderboard)
        .setDescription("Show the top 10 richest players by GP"),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();

        try {
            const res = await honoClient.gp_leaderboard.$post();
            const result = (await res.json()) as GpLeaderboardResponse;

            if (!result.players.length) {
                await interaction.editReply("No GP leaderboard data found.");
                return;
            }

            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("GP Leaderboard")
                        .setColor(0xf2b84b)
                        .setDescription(
                            result.players
                                .map(
                                    (player, index) =>
                                        `**${index + 1}.** ${displayAccountName(player)} - **${formatGp(player.gpBalance)} GP**`,
                                )
                                .join("\n"),
                        ),
                ],
            });
        } catch (error) {
            botLogger.error("Error in gp_leaderboard command:", error);
            await interaction.editReply({
                content: "An error occurred while loading the GP leaderboard.",
            });
        }
    },
};
