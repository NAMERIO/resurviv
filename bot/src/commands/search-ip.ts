import {
    type ChatInputCommandInteraction,
    EmbedBuilder,
    SlashCommandBuilder,
} from "discord.js";
import type { InferResponseType } from "hono";
import { util } from "../../../shared/utils/util";
import { botLogger, Command, honoClient } from "../utils";

type SearchIpResult = InferResponseType<
    typeof honoClient.moderation.search_ip.$post,
    200
>;

function buildSessionField(
    session: Extract<SearchIpResult, { results: unknown[] }>["results"][number],
    index: number,
    discordUsernames: Map<string, string>,
) {
    const discordUsername = session.discordId
        ? discordUsernames.get(session.discordId) || "Unable to resolve"
        : null;

    return {
        name: `${index + 1}. ${session.username}`,
        value: [
            `**Account slug:** ${session.slug || "Unlinked account"}`,
            `**Account system:** ${session.accountSystem}`,
            ...(discordUsername ? [`**Discord username:** ${discordUsername}`] : []),
            `**Region:** ${session.region.toUpperCase()}`,
            `**Game ID:** ${session.gameId}`,
            `**Mode:** ${session.teamMode}`,
            `**Map:** ${session.mapId}`,
            `**Played at:** ${util.formatDate(session.createdAt)}`,
        ].join("\n"),
        inline: false,
    };
}

export const searchIpHandler = {
    command: new SlashCommandBuilder()
        .setName(Command.SearchIp)
        .setDescription("Search account and game history by IP")
        .addStringOption((option) =>
            option.setName("ip").setDescription("The IP to search for").setRequired(true),
        )
        .addBooleanOption((option) =>
            option
                .setName("is_encoded")
                .setDescription("If the provided IP is encoded (defaults to true)")
                .setRequired(false),
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const ip = interaction.options.getString("ip")!;
        const isEncoded = interaction.options.getBoolean("is_encoded") ?? true;

        await interaction.deferReply();

        try {
            const response = await honoClient.moderation.search_ip.$post({
                json: {
                    ip,
                    is_encoded: isEncoded,
                },
            });

            if (!response.ok) {
                await interaction.editReply("Failed to search IP.");
                return;
            }

            const result = await response.json();
            if ("message" in result) {
                await interaction.editReply(result.message);
                return;
            }

            const discordIds = [
                ...new Set(
                    result.results
                        .map((session) => session.discordId)
                        .filter((discordId): discordId is string => Boolean(discordId)),
                ),
            ];
            const discordUsernames = new Map<string, string>();
            await Promise.all(
                discordIds.map(async (discordId) => {
                    try {
                        const user = await interaction.client.users.fetch(discordId);
                        discordUsernames.set(discordId, user.username);
                    } catch {
                        discordUsernames.set(discordId, "Unable to resolve");
                    }
                }),
            );

            const embed = new EmbedBuilder()
                .setColor(0x0099ff)
                .setTitle("IP Search Results")
                .setDescription(
                    `Found ${result.results.length} recent game session(s) for the provided IP.`,
                )
                .addFields({
                    name: "Encoded IP",
                    value: result.encodedIp,
                    inline: false,
                })
                .addFields(
                    result.results.map((session, index) =>
                        buildSessionField(session, index, discordUsernames),
                    ),
                )
                .setFooter({ text: "Showing up to 10 recent sessions" })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            botLogger.error("Error in search_ip command:", error);
            await interaction.editReply("An error occurred while searching for the IP.");
        }
    },
};
