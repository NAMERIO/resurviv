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

const rankLabels = ["#1", "#2", "#3"] as const;

function displayAccountName(player: { username: string; slug: string }) {
    return escapeMarkdown(player.username || player.slug);
}

function formatRank(value: number) {
    return value.toLocaleString("en-US");
}

function getRankLabel(index: number) {
    return rankLabels[index] ?? `#${index + 1}`;
}

function buildTopRankPlayersEmbed(result: TopRankPlayersResponse) {
    const leader = result.players[0];
    const otherPlayers = result.players.slice(1);
    const totalPlayers = result.players.length;

    const embed = new EmbedBuilder()
        .setTitle("Rank Leaderboard")
        .setColor(0x2f80ed)
        .setDescription(
            [
                `**${intervalLabels[result.interval]} Top ${totalPlayers}**`,
                "",
                `**#1  ${displayAccountName(leader)}**`,
                `Global rank: \`#${formatRank(leader.val)}\``,
            ].join("\n"),
        )
        .setFooter({ text: "Ranks are sorted by global rank score" })
        .setTimestamp();

    if (otherPlayers.length) {
        embed.addFields(
            otherPlayers.map((player, index) => ({
                name: `${getRankLabel(index + 1)}  ${displayAccountName(player)}`,
                value: `Global rank: \`#${formatRank(player.val)}\``,
                inline: true,
            })),
        );
    }

    return embed;
}

function buildEmptyRankEmbed(interval: RankInterval) {
    return new EmbedBuilder()
        .setTitle("Rank Leaderboard")
        .setColor(0x2f80ed)
        .setDescription(`No ranked player data found for ${intervalLabels[interval]}.`)
        .setTimestamp();
}

export const topRankPlayersHandler = {
    command: new SlashCommandBuilder()
        .setName(Command.TopRankPlayers)
        .setDescription("Show the top ranked players")
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
            (interaction.options.getString("time") as RankInterval | null) ?? "alltime";

        try {
            const res = await honoClient.top_rank_players.$post({
                json: { interval },
            });
            const result = (await res.json()) as TopRankPlayersResponse;

            if (!result.players.length) {
                await interaction.editReply({
                    embeds: [buildEmptyRankEmbed(interval)],
                });
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
