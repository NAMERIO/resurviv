import { type ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { Command } from "../utils";

export default {
    command: new SlashCommandBuilder()
        .setName(Command.DecodeIp)
        .setDescription("Decodes an IP")
        .addStringOption((option) =>
            option.setName("ip").setDescription("The IP to decode").setRequired(true),
        ),
    async execute(interaction: ChatInputCommandInteraction) {
        const _message = interaction.options.getString("ip");
        const result = "Not implemeted"; // decodeIP(message!);
        await interaction.reply(JSON.stringify(result, null, 2));
    },
};
