import {
    type ChatInputCommandInteraction,
    EmbedBuilder,
    MessageFlags,
    SlashCommandBuilder,
} from "discord.js";
import { botLogger, Command, honoClient } from "../utils";

type BalanceResponse =
    | {
          ok: false;
          message: string;
      }
    | {
          ok: true;
          player: {
              slug: string;
              username: string;
              gpBalance: number;
          };
      };

function formatGp(value: number) {
    return value.toLocaleString("en-US");
}

function displayAccountName(player: { username: string; slug: string }) {
    return player.username || player.slug;
}

export const balanceHandler = {
    command: new SlashCommandBuilder()
        .setName(Command.Balance)
        .setDescription("Check your connected game account GP balance"),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const res = await honoClient.discord_balance.$post({
                json: {
                    discord_id: interaction.user.id,
                },
            });
            const result = (await res.json()) as BalanceResponse;

            if (!result.ok) {
                await interaction.editReply({
                    content: result.message,
                });
                return;
            }

            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("GP Balance")
                        .setColor(0xf2b84b)
                        .setDescription(
                            `${interaction.user}, your connected account **${displayAccountName(result.player)}** has **${formatGp(result.player.gpBalance)} GP**.`,
                        ),
                ],
            });
        } catch (error) {
            botLogger.error("Error in balance command:", error);
            await interaction.editReply({
                content: "An error occurred while checking your balance.",
            });
        }
    },
};
