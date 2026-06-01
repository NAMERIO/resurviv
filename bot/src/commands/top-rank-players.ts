import {
    type ChatInputCommandInteraction,
    EmbedBuilder,
    escapeMarkdown,
    SlashCommandBuilder,
} from "discord.js";
import { botLogger, Command, honoClient } from "../utils";

type RankInterval = "daily" | "weekly" | "alltime";

type TopRankPlayersResponse = {
    ok: true;
    interval: RankInterval;
    players: {
        slug: string;
        username: string;
        val: number;
    }[];
};

const intervalLabels: Record<RankInterval, string> = {
    daily: "Today",
    weekly: "This Week",
    alltime: "All Time",
};

function displayAccountName(player: { username: string; slug: string }) {
    return escapeMarkdown(player.username || player.slug);
}

function buildTopRankPlayersEmbed(result: TopRankPlayersResponse) {
    return new EmbedBuilder()
        .setTitle(`Top 10 Ranked Players - ${intervalLabels[result.interval]}`)
        .setColor(0x5fb3ff)
        .setDescription(
            result.players
                .map(
                    (player, index) =>
                        `**#${index + 1}** ${displayAccountName(player)} - rank \`#${player.val}\``,
                )
                .join("\n"),
        )
        .setFooter({ text: "Sorted by global rank score" })
        .setTimestamp();
}

export const topRankPlayersHandler = {
    command: new SlashCommandBuilder()
        .setName(Command.TopRankPlayers)
        .setDescription("Show the top 10 ranked players")
        .addStringOption((option) =>
            option
                .setName("time")
                .setDescription("Rank period")
                .setRequired(false)
                .addChoices(
                    { name: "Today", value: "daily" },
                    { name: "This Week", value: "weekly" },
                    { name: "All Time", value: "alltime" },
                ),
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();

        const interval =
            (interaction.options.getString("time") as RankInterval | null) ?? "daily";

        try {
            const res = await honoClient.top_rank_players.$post({
                json: { interval },
            });
            const result = (await res.json()) as TopRankPlayersResponse;

            if (!result.players.length) {
                await interaction.editReply(
                    `No ranked player data found for ${intervalLabels[interval]}.`,
                );
                return;
            }

            await interaction.editReply({
                embeds: [buildTopRankPlayersEmbed(result)],
            });
        } catch (error) {
            botLogger.error("Error in top_rank_players command:", error);
            await interaction.editReply({
                content: "An error occurred while loading top ranked players.",
            });
        }
    },
};
