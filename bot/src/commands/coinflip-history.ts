import {
    type ChatInputCommandInteraction,
    EmbedBuilder,
    escapeMarkdown,
    SlashCommandBuilder,
} from "discord.js";
import { botLogger, Command, honoClient } from "../utils";

type CoinFlipHistoryPlayer = {
    slug: string;
    username: string;
};

type CoinFlipHistoryGame = {
    id: string;
    bet: number;
    coinResult: "heads" | "tails";
    opponentPick: "heads" | "tails";
    createdAt: string;
    challenger: CoinFlipHistoryPlayer;
    opponent: CoinFlipHistoryPlayer;
    winner: CoinFlipHistoryPlayer;
    loser: CoinFlipHistoryPlayer;
    result: "won" | "lost";
};

type CoinFlipHistoryResponse =
    | {
          ok: false;
          message: string;
      }
    | {
          ok: true;
          player: CoinFlipHistoryPlayer & {
              gpBalance: number;
          };
          history: CoinFlipHistoryGame[];
      };

type CoinFlipHistoryAccount = Extract<CoinFlipHistoryResponse, { ok: true }>["player"];

function formatGp(value: number) {
    return value.toLocaleString("en-US");
}

function displayAccountName(player: CoinFlipHistoryPlayer) {
    return escapeMarkdown(player.username || player.slug);
}

function formatTimestamp(value: string) {
    const unixSeconds = Math.floor(new Date(value).getTime() / 1000);
    return `<t:${unixSeconds}:f>`;
}

function titleCase(value: string) {
    return value[0].toUpperCase() + value.slice(1);
}

function buildHistoryEmbed(
    player: CoinFlipHistoryAccount,
    history: CoinFlipHistoryGame[],
) {
    const wins = history.filter((game) => game.result === "won").length;
    const losses = history.length - wins;
    const netGp = history.reduce(
        (sum, game) => sum + (game.result === "won" ? game.bet : -game.bet),
        0,
    );

    const embed = new EmbedBuilder()
        .setTitle("Coinflip History")
        .setColor(netGp >= 0 ? 0x4fbf7a : 0xd95f59)
        .setDescription(
            [
                `History for **${displayAccountName(player)}**`,
                `Record in shown games: **${wins}W - ${losses}L**`,
                `Net result: **${netGp >= 0 ? "+" : ""}${formatGp(netGp)} GP**`,
            ].join("\n"),
        )
        .setFooter({ text: "Newest coinflips first" })
        .setTimestamp();

    embed.addFields(
        history.map((game, index) => {
            const opponent =
                game.challenger.slug === player.slug ? game.opponent : game.challenger;
            const resultLabel = game.result === "won" ? "Win" : "Loss";
            const gpPrefix = game.result === "won" ? "+" : "-";

            return {
                name: `#${index + 1}  ${resultLabel} vs ${displayAccountName(opponent)}`,
                value: [
                    `${formatTimestamp(game.createdAt)} • **${gpPrefix}${formatGp(game.bet)} GP**`,
                    `Coin: **${titleCase(game.coinResult)}** • Opponent picked **${titleCase(game.opponentPick)}**`,
                    `Winner: **${displayAccountName(game.winner)}** • Loser: **${displayAccountName(game.loser)}**`,
                ].join("\n"),
                inline: false,
            };
        }),
    );

    return embed;
}

export const coinFlipHistoryHandler = {
    command: new SlashCommandBuilder()
        .setName(Command.CoinFlipHistory)
        .setDescription("Show your recent GP coinflip history")
        .addIntegerOption((option) =>
            option
                .setName("limit")
                .setDescription("Number of recent coinflips to show")
                .setMinValue(1)
                .setMaxValue(25)
                .setRequired(false),
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();

        try {
            const res = await honoClient.coinflip_history.$post({
                json: {
                    discord_id: interaction.user.id,
                    limit: interaction.options.getInteger("limit") ?? 10,
                },
            });
            const result = (await res.json()) as CoinFlipHistoryResponse;

            if (!result.ok) {
                await interaction.editReply({
                    content: result.message,
                });
                return;
            }

            if (!result.history.length) {
                await interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle("Coinflip History")
                            .setColor(0xf2b84b)
                            .setDescription(
                                `No completed coinflips found for **${displayAccountName(result.player)}** yet.`,
                            ),
                    ],
                });
                return;
            }

            await interaction.editReply({
                embeds: [buildHistoryEmbed(result.player, result.history)],
            });
        } catch (error) {
            botLogger.error("Error in coinflip_history command:", error);
            await interaction.editReply({
                content: "An error occurred while loading coinflip history.",
            });
        }
    },
};
