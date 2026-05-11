import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    type ChatInputCommandInteraction,
    ComponentType,
    EmbedBuilder,
    MessageFlags,
    SlashCommandBuilder,
    type User,
} from "discord.js";
import { botLogger, Command, honoClient } from "../utils";

type CoinFlipPlayer = {
    slug: string;
    username: string;
    gpBalance: number;
};

type CoinFlipErrorResponse = {
    ok: false;
    reason: string;
    message: string;
};

type CoinFlipCheckResponse =
    | CoinFlipErrorResponse
    | {
          ok: true;
          challenger: CoinFlipPlayer;
          opponent: CoinFlipPlayer;
      };

type CoinFlipResolveResponse =
    | CoinFlipErrorResponse
    | {
          ok: true;
          bet: number;
          coinResult: "heads" | "tails";
          opponentPick: "heads" | "tails";
          winner: CoinFlipPlayer;
          loser: CoinFlipPlayer;
      };

const TIMEOUT_IN_MS = 60 * 1000;
const HEADS_BUTTON_ID = "coinflip_heads";
const TAILS_BUTTON_ID = "coinflip_tails";
const DECLINE_BUTTON_ID = "coinflip_decline";

function formatGp(value: number) {
    return value.toLocaleString("en-US");
}

function displayAccountName(player: { username: string; slug: string }) {
    return player.username || player.slug;
}

function buildInviteEmbed({
    challenger,
    opponent,
    bet,
}: {
    challenger: User;
    opponent: User;
    bet: number;
}) {
    return new EmbedBuilder()
        .setTitle("Coinflip Challenge")
        .setColor(0xf2b84b)
        .setDescription(
            `${challenger} challenged ${opponent} to a **${formatGp(bet)} GP** coinflip.`,
        )
        .addFields(
            {
                name: "How it works",
                value: `${opponent}, choose Heads or Tails to accept. Winner takes **${formatGp(bet)} GP** from the loser.`,
            },
            {
                name: "Expires",
                value: "This invite expires in 60 seconds.",
                inline: true,
            },
        );
}

function buildResultEmbed({
    result,
    challenger,
    opponent,
}: {
    result: Extract<CoinFlipResolveResponse, { ok: true }>;
    challenger: User;
    opponent: User;
}) {
    return new EmbedBuilder()
        .setTitle(`${result.coinResult === "heads" ? "Heads" : "Tails"} wins`)
        .setColor(0x4fbf7a)
        .setDescription(
            [
                `The coin landed on **${result.coinResult}**.`,
                `${opponent} picked **${result.opponentPick}**.`,
            ].join("\n"),
        )
        .addFields(
            {
                name: "Winner",
                value: `${displayAccountName(result.winner)} gained **${formatGp(result.bet)} GP**.`,
                inline: true,
            },
            {
                name: "Loser",
                value: `${displayAccountName(result.loser)} lost **${formatGp(result.bet)} GP**.`,
                inline: true,
            },
            {
                name: "New balances",
                value: [
                    `${displayAccountName(result.winner)}: **${formatGp(result.winner.gpBalance)} GP**`,
                    `${displayAccountName(result.loser)}: **${formatGp(result.loser.gpBalance)} GP**`,
                ].join("\n"),
            },
        )
        .setFooter({
            text: `${challenger.username} vs ${opponent.username}`,
        });
}

function buildActionRow(disabled = false) {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(HEADS_BUTTON_ID)
            .setLabel("Heads")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId(TAILS_BUTTON_ID)
            .setLabel("Tails")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId(DECLINE_BUTTON_ID)
            .setLabel("Decline")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(disabled),
    );
}

async function sendEphemeral(interaction: ChatInputCommandInteraction, content: string) {
    const payload = { content, flags: MessageFlags.Ephemeral } as const;

    if (interaction.replied || interaction.deferred) {
        await interaction.followUp(payload);
        return;
    }

    await interaction.reply(payload);
}

export const coinFlipHandler = {
    command: new SlashCommandBuilder()
        .setName(Command.CoinFlip)
        .setDescription("Challenge another connected Discord user to a GP coinflip")
        .addUserOption((option) =>
            option
                .setName("user")
                .setDescription("The Discord user to challenge")
                .setRequired(true),
        )
        .addIntegerOption((option) =>
            option
                .setName("bet")
                .setDescription("The GP each player is risking")
                .setMinValue(1)
                .setRequired(true),
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const opponent = interaction.options.getUser("user", true);
        const bet = interaction.options.getInteger("bet", true);
        const challenger = interaction.user;

        if (opponent.bot) {
            await sendEphemeral(interaction, "You cannot coinflip against a bot.");
            return;
        }

        if (opponent.id === challenger.id) {
            await sendEphemeral(interaction, "You cannot coinflip against yourself.");
            return;
        }

        await interaction.deferReply();

        try {
            const checkRes = await honoClient.coinflip_check.$post({
                json: {
                    challenger_discord_id: challenger.id,
                    opponent_discord_id: opponent.id,
                    bet,
                },
            });
            const check = (await checkRes.json()) as CoinFlipCheckResponse;

            if (!check.ok) {
                await interaction.editReply({ content: check.message });
                return;
            }

            const response = await interaction.editReply({
                content: `${opponent} ${challenger} sent you a coinflip challenge for **${formatGp(bet)} GP**.`,
                embeds: [buildInviteEmbed({ challenger, opponent, bet })],
                components: [buildActionRow()],
                allowedMentions: { users: [opponent.id, challenger.id] },
            });

            const collector = response.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: TIMEOUT_IN_MS,
            });

            collector.on("collect", async (buttonInteraction) => {
                if (buttonInteraction.user.id !== opponent.id) {
                    await buttonInteraction.reply({
                        content: "Only the challenged user can accept this coinflip.",
                        flags: MessageFlags.Ephemeral,
                    });
                    return;
                }

                if (buttonInteraction.customId === DECLINE_BUTTON_ID) {
                    collector.stop("declined");
                    await buttonInteraction.update({
                        content: `${opponent} declined ${challenger}'s coinflip challenge.`,
                        embeds: [],
                        components: [],
                        allowedMentions: { users: [opponent.id, challenger.id] },
                    });
                    return;
                }

                const opponentPick =
                    buttonInteraction.customId === HEADS_BUTTON_ID ? "heads" : "tails";

                collector.stop("completed");
                await buttonInteraction.deferUpdate();

                const resolveRes = await honoClient.coinflip_resolve.$post({
                    json: {
                        challenger_discord_id: challenger.id,
                        opponent_discord_id: opponent.id,
                        bet,
                        opponent_pick: opponentPick,
                    },
                });
                const result = (await resolveRes.json()) as CoinFlipResolveResponse;

                if (!result.ok) {
                    await interaction.editReply({
                        content: result.message,
                        embeds: [],
                        components: [],
                    });
                    return;
                }

                const winnerMention =
                    result.winner.slug === check.challenger.slug ? challenger : opponent;
                const loserMention =
                    result.loser.slug === check.challenger.slug ? challenger : opponent;

                await interaction.editReply({
                    content: `${winnerMention} won **${formatGp(result.bet)} GP** from ${loserMention}.`,
                    embeds: [buildResultEmbed({ result, challenger, opponent })],
                    components: [],
                    allowedMentions: {
                        users: [winnerMention.id, loserMention.id],
                    },
                });
            });

            collector.on("end", async (_, reason) => {
                if (reason !== "time") return;

                await interaction.editReply({
                    content: `${opponent} did not answer ${challenger}'s coinflip challenge in time.`,
                    embeds: [],
                    components: [],
                    allowedMentions: { users: [opponent.id, challenger.id] },
                });
            });
        } catch (error) {
            botLogger.error("Error in coinflip command:", error);
            await interaction.editReply({
                content: "An error occurred while running the coinflip.",
                embeds: [],
                components: [],
            });
        }
    },
};
