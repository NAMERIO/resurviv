import { randomInt } from "node:crypto";
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

type BlackjackPlayer = {
    slug: string;
    username: string;
    gpBalance: number;
};

type BlackjackErrorResponse = {
    ok: false;
    reason: string;
    message: string;
};

type BlackjackCheckResponse =
    | BlackjackErrorResponse
    | {
          ok: true;
          challenger: BlackjackPlayer;
          opponent: BlackjackPlayer;
      };

type BlackjackResolveResponse =
    | BlackjackErrorResponse
    | {
          ok: true;
          bet: number;
          winner: BlackjackPlayer;
          loser: BlackjackPlayer;
      };

type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";
type Suit = "spades" | "hearts" | "diamonds" | "flowers";
type Card = {
    rank: Rank;
    suit: Suit;
};

const TIMEOUT_IN_MS = 60 * 1000;
const ACCEPT_BUTTON_ID = "blackjack_accept";
const DECLINE_BUTTON_ID = "blackjack_decline";
const CANCEL_BUTTON_ID = "blackjack_cancel";
const HIT_BUTTON_ID = "blackjack_hit";
const STAND_BUTTON_ID = "blackjack_stand";
const activeBlackjackUsers = new Set<string>();

function releaseBlackjackUsers(challengerId: string, opponentId: string) {
    activeBlackjackUsers.delete(challengerId);
    activeBlackjackUsers.delete(opponentId);
}

function formatGp(value: number) {
    return value.toLocaleString("en-US");
}

function displayAccountName(player: { username: string; slug: string }) {
    return player.username || player.slug;
}

function createDeck() {
    const ranks: Rank[] = [
        "A",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
        "10",
        "J",
        "Q",
        "K",
    ];
    const suits: Suit[] = ["spades", "hearts", "diamonds", "flowers"];
    const deck: Card[] = [];

    for (const suit of suits) {
        for (const rank of ranks) {
            deck.push({ rank, suit });
        }
    }

    for (let i = deck.length - 1; i > 0; i--) {
        const j = randomInt(i + 1);
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    return deck;
}

function draw(deck: Card[]) {
    const card = deck.pop();
    if (!card) {
        throw new Error("Blackjack deck ran out of cards.");
    }
    return card;
}

function handValue(hand: Card[]) {
    let value = 0;
    let aces = 0;

    for (const card of hand) {
        if (card.rank === "A") {
            value += 11;
            aces++;
        } else if (["J", "Q", "K"].includes(card.rank)) {
            value += 10;
        } else {
            value += Number(card.rank);
        }
    }

    while (value > 21 && aces > 0) {
        value -= 10;
        aces--;
    }

    return value;
}

function formatCard(card: Card) {
    return `${card.rank} of ${card.suit}`;
}

function formatHand(hand: Card[]) {
    return hand.map(formatCard).join(", ");
}

function buildInviteRow(disabled = false) {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(ACCEPT_BUTTON_ID)
            .setLabel("Accept")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId(DECLINE_BUTTON_ID)
            .setLabel("Decline")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId(CANCEL_BUTTON_ID)
            .setLabel("Cancel")
            .setStyle(ButtonStyle.Danger)
            .setDisabled(disabled),
    );
}

function buildGameRow({ disabled = false, canCancel = false } = {}) {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(HIT_BUTTON_ID)
            .setLabel("Pull")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId(STAND_BUTTON_ID)
            .setLabel("Stand")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(disabled),
    );

    if (canCancel) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(CANCEL_BUTTON_ID)
                .setLabel("Cancel")
                .setStyle(ButtonStyle.Danger)
                .setDisabled(disabled),
        );
    }

    return row;
}

function buildGameEmbed({
    challenger,
    opponent,
    bet,
    dealerHand,
    playerHand,
    status,
}: {
    challenger: User;
    opponent: User;
    bet: number;
    dealerHand: Card[];
    playerHand: Card[];
    status: string;
}) {
    return new EmbedBuilder()
        .setTitle("Blackjack")
        .setColor(0x2e8b57)
        .setDescription(status)
        .addFields(
            {
                name: `Dealer - ${challenger.username}`,
                value: `${formatHand(dealerHand)}\nTotal: **${handValue(dealerHand)}**`,
            },
            {
                name: `Player - ${opponent.username}`,
                value: `${formatHand(playerHand)}\nTotal: **${handValue(playerHand)}**`,
            },
            {
                name: "Bet",
                value: `**${formatGp(bet)} GP**`,
                inline: true,
            },
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

async function parseApiJson<T>(
    response: { status: number; text: () => Promise<string> },
    route: string,
): Promise<T> {
    const body = await response.text();

    try {
        return JSON.parse(body) as T;
    } catch (error) {
        throw new Error(
            `${route} returned non-JSON response (${response.status}): ${body.slice(0, 200)}`,
            { cause: error },
        );
    }
}

function isNonJsonApiError(error: unknown) {
    return error instanceof Error && error.message.includes("non-JSON response");
}

export const blackjackHandler = {
    command: new SlashCommandBuilder()
        .setName(Command.Blackjack)
        .setDescription("Challenge another connected Discord user to GP blackjack")
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
            await sendEphemeral(interaction, "You cannot play blackjack against a bot.");
            return;
        }

        if (opponent.id === challenger.id) {
            await sendEphemeral(
                interaction,
                "You cannot play blackjack against yourself.",
            );
            return;
        }

        await interaction.deferReply();

        try {
            const checkRes = await honoClient.blackjack_check.$post({
                json: {
                    challenger_discord_id: challenger.id,
                    opponent_discord_id: opponent.id,
                    bet,
                },
            });
            const check = await parseApiJson<BlackjackCheckResponse>(
                checkRes,
                "blackjack_check",
            );

            if (!check.ok) {
                await interaction.editReply({ content: check.message });
                return;
            }

            if (activeBlackjackUsers.has(challenger.id)) {
                await interaction.editReply({
                    content:
                        "You are still in a blackjack game. Wait a minute for it to finish.",
                });
                return;
            }

            if (activeBlackjackUsers.has(opponent.id)) {
                await interaction.editReply({
                    content:
                        "That user is still in a blackjack game. Wait a minute for it to finish.",
                });
                return;
            }

            activeBlackjackUsers.add(challenger.id);
            activeBlackjackUsers.add(opponent.id);

            const response = await interaction.editReply({
                content: `${opponent} ${challenger} challenged you to blackjack for **${formatGp(bet)} GP**.`,
                embeds: [
                    new EmbedBuilder()
                        .setTitle("Blackjack Challenge")
                        .setColor(0x2e8b57)
                        .setDescription(
                            `${challenger} is the dealer. ${opponent} pulls cards or stands. Highest total at or below 21 wins; dealer wins ties.`,
                        )
                        .addFields({
                            name: "Expires",
                            value: "This invite expires in 60 seconds.",
                            inline: true,
                        }),
                ],
                components: [buildInviteRow()],
                allowedMentions: { users: [opponent.id, challenger.id] },
            });

            const inviteCollector = response.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: TIMEOUT_IN_MS,
            });

            inviteCollector.on("collect", async (buttonInteraction) => {
                if (buttonInteraction.customId === CANCEL_BUTTON_ID) {
                    if (buttonInteraction.user.id !== challenger.id) {
                        await buttonInteraction.reply({
                            content:
                                "Only the dealer can cancel this blackjack challenge.",
                            flags: MessageFlags.Ephemeral,
                        });
                        return;
                    }

                    inviteCollector.stop("cancelled");
                    releaseBlackjackUsers(challenger.id, opponent.id);
                    await buttonInteraction.update({
                        content: `${challenger} cancelled the blackjack challenge with ${opponent}.`,
                        embeds: [],
                        components: [],
                        allowedMentions: { users: [challenger.id, opponent.id] },
                    });
                    return;
                }

                if (buttonInteraction.user.id !== opponent.id) {
                    await buttonInteraction.reply({
                        content:
                            "Only the challenged user can accept or decline this blackjack game.",
                        flags: MessageFlags.Ephemeral,
                    });
                    return;
                }

                if (buttonInteraction.customId === DECLINE_BUTTON_ID) {
                    inviteCollector.stop("declined");
                    releaseBlackjackUsers(challenger.id, opponent.id);
                    await buttonInteraction.update({
                        content: `${opponent} declined ${challenger}'s blackjack challenge.`,
                        embeds: [],
                        components: [],
                        allowedMentions: { users: [opponent.id, challenger.id] },
                    });
                    return;
                }

                inviteCollector.stop("accepted");
                const deck = createDeck();
                const dealerHand = [draw(deck)];
                const playerHand = [draw(deck)];

                await buttonInteraction.update({
                    content: `${opponent}, pull or stand.`,
                    embeds: [
                        buildGameEmbed({
                            challenger,
                            opponent,
                            bet,
                            dealerHand,
                            playerHand,
                            status: "The dealer took the first card. The player has the turn.",
                        }),
                    ],
                    components: [buildGameRow({ canCancel: true })],
                    allowedMentions: { users: [opponent.id, challenger.id] },
                });

                const gameCollector = response.createMessageComponentCollector({
                    componentType: ComponentType.Button,
                    time: TIMEOUT_IN_MS,
                });
                let playerPulled = false;

                const finishGame = async (
                    reason: string,
                    winnerUser: User,
                    loserUser: User,
                ) => {
                    gameCollector.stop("completed");

                    const resolveRes = await honoClient.blackjack_resolve.$post({
                        json: {
                            challenger_discord_id: challenger.id,
                            opponent_discord_id: opponent.id,
                            winner_discord_id: winnerUser.id,
                            loser_discord_id: loserUser.id,
                            bet,
                        },
                    });
                    const result = await parseApiJson<BlackjackResolveResponse>(
                        resolveRes,
                        "blackjack_resolve",
                    );

                    if (!result.ok) {
                        await interaction.editReply({
                            content: result.message,
                            embeds: [],
                            components: [],
                        });
                        return;
                    }

                    await interaction.editReply({
                        content: `${winnerUser} won **${formatGp(result.bet)} GP** from ${loserUser}.`,
                        embeds: [
                            buildGameEmbed({
                                challenger,
                                opponent,
                                bet,
                                dealerHand,
                                playerHand,
                                status: reason,
                            }).addFields({
                                name: "New balances",
                                value: [
                                    `${displayAccountName(result.winner)}: **${formatGp(result.winner.gpBalance)} GP**`,
                                    `${displayAccountName(result.loser)}: **${formatGp(result.loser.gpBalance)} GP**`,
                                ].join("\n"),
                            }),
                        ],
                        components: [],
                        allowedMentions: { users: [winnerUser.id, loserUser.id] },
                    });
                };

                gameCollector.on("collect", async (gameInteraction) => {
                    if (gameInteraction.user.id !== opponent.id) {
                        await gameInteraction.reply({
                            content: "Only the player can pull or stand.",
                            flags: MessageFlags.Ephemeral,
                        });
                        return;
                    }

                    try {
                        if (gameInteraction.customId === CANCEL_BUTTON_ID) {
                            if (playerPulled) {
                                await gameInteraction.reply({
                                    content: "You cannot cancel after pulling a card.",
                                    flags: MessageFlags.Ephemeral,
                                });
                                return;
                            }

                            gameCollector.stop("cancelled");
                            releaseBlackjackUsers(challenger.id, opponent.id);
                            await gameInteraction.update({
                                content: `${opponent} cancelled the blackjack game before pulling a card.`,
                                embeds: [],
                                components: [],
                                allowedMentions: {
                                    users: [opponent.id, challenger.id],
                                },
                            });
                            return;
                        }

                        if (gameInteraction.customId === HIT_BUTTON_ID) {
                            playerPulled = true;
                            playerHand.push(draw(deck));
                            const playerTotal = handValue(playerHand);

                            if (playerTotal > 21) {
                                await gameInteraction.deferUpdate();
                                await finishGame(
                                    `${opponent} busted with **${playerTotal}**. The dealer wins.`,
                                    challenger,
                                    opponent,
                                );
                                return;
                            }

                            await gameInteraction.update({
                                content: `${opponent}, pull or stand.`,
                                embeds: [
                                    buildGameEmbed({
                                        challenger,
                                        opponent,
                                        bet,
                                        dealerHand,
                                        playerHand,
                                        status: `${opponent} pulled ${formatCard(playerHand[playerHand.length - 1])}.`,
                                    }),
                                ],
                                components: [buildGameRow()],
                                allowedMentions: { users: [opponent.id, challenger.id] },
                            });
                            return;
                        }

                        const dealerCardsBeforeStand = dealerHand.length;

                        while (handValue(dealerHand) < 17) {
                            dealerHand.push(draw(deck));
                        }

                        const dealerTotal = handValue(dealerHand);
                        const playerTotal = handValue(playerHand);
                        const playerWins = dealerTotal > 21 || playerTotal > dealerTotal;
                        const dealerPulledCards =
                            dealerHand.length - dealerCardsBeforeStand;
                        const dealerAction =
                            dealerPulledCards > 0
                                ? `${challenger} pulled ${dealerPulledCards} card${dealerPulledCards === 1 ? "" : "s"}`
                                : `${challenger} did not pull`;

                        await gameInteraction.deferUpdate();
                        await finishGame(
                            dealerTotal > 21
                                ? `${opponent} stood with **${playerTotal}**. ${dealerAction} and busted with **${dealerTotal}**.`
                                : playerWins
                                  ? `${opponent} stood with **${playerTotal}**. ${dealerAction} and stopped at **${dealerTotal}**.`
                                  : `${opponent} stood with **${playerTotal}**. ${dealerAction}; ${challenger} wins with **${dealerTotal}**.`,
                            playerWins ? opponent : challenger,
                            playerWins ? challenger : opponent,
                        );
                    } catch (error) {
                        gameCollector.stop("errored");
                        releaseBlackjackUsers(challenger.id, opponent.id);
                        botLogger.error("Error while resolving blackjack:", error);
                        await interaction.editReply({
                            content: isNonJsonApiError(error)
                                ? "The blackjack API route is not available yet. Update and restart the API server, then try again."
                                : "An error occurred while running blackjack.",
                            embeds: [],
                            components: [],
                        });
                    }
                });

                gameCollector.on("end", async (_, reason) => {
                    if (
                        reason === "completed" ||
                        reason === "errored" ||
                        reason === "cancelled"
                    ) {
                        releaseBlackjackUsers(challenger.id, opponent.id);
                        return;
                    }

                    releaseBlackjackUsers(challenger.id, opponent.id);
                    await interaction.editReply({
                        content: `${opponent} did not finish the blackjack game in time.`,
                        embeds: [],
                        components: [],
                        allowedMentions: { users: [opponent.id, challenger.id] },
                    });
                });
            });

            inviteCollector.on("end", async (_, reason) => {
                if (reason !== "time") return;

                releaseBlackjackUsers(challenger.id, opponent.id);
                await interaction.editReply({
                    content: `${opponent} did not answer ${challenger}'s blackjack challenge in time.`,
                    embeds: [],
                    components: [],
                    allowedMentions: { users: [opponent.id, challenger.id] },
                });
            });
        } catch (error) {
            releaseBlackjackUsers(challenger.id, opponent.id);
            botLogger.error("Error in blackjack command:", error);
            await interaction.editReply({
                content: isNonJsonApiError(error)
                    ? "The blackjack API route is not available yet. Update and restart the API server, then try again."
                    : "An error occurred while running blackjack.",
                embeds: [],
                components: [],
            });
        }
    },
};
