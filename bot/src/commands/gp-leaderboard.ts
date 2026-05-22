import {
    type ChatInputCommandInteraction,
    EmbedBuilder,
    escapeMarkdown,
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
    return escapeMarkdown(player.username || player.slug);
}

function getRankLabel(index: number) {
    if (index === 0) return "#1";
    if (index === 1) return "#2";
    if (index === 2) return "#3";
    return `#${index + 1}`;
}

function buildGpLeaderboardEmbed(players: GpLeaderboardResponse["players"]) {
    const totalGp = players.reduce((sum, player) => sum + player.gpBalance, 0);
    const leader = players[0];
    const remainingPlayers = players.slice(1);

    const embed = new EmbedBuilder()
        .setTitle("GP Leaderboard")
        .setColor(0xf2b84b)
        .setDescription(
            [
                "**Top GP holders**",
                `Showing ${players.length} ranked player${players.length === 1 ? "" : "s"} with **${formatGp(totalGp)} GP** combined.`,
                "",
                `**${getRankLabel(0)}  ${displayAccountName(leader)}**`,
                `\`${formatGp(leader.gpBalance)} GP\``,
            ].join("\n"),
        )
        .setFooter({ text: "Sorted by current GP balance" })
        .setTimestamp();

    if (remainingPlayers.length) {
        embed.addFields(
            remainingPlayers.map((player, index) => ({
                name: `${getRankLabel(index + 1)}  ${displayAccountName(player)}`,
                value: `\`${formatGp(player.gpBalance)} GP\``,
                inline: true,
            })),
        );
    }

    return embed;
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
                embeds: [buildGpLeaderboardEmbed(result.players)],
            });
        } catch (error) {
            botLogger.error("Error in gp_leaderboard command:", error);
            await interaction.editReply({
                content: "An error occurred while loading the GP leaderboard.",
            });
        }
    },
};
