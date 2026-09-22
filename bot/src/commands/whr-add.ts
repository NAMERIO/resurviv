import {
    ActionRowBuilder,
    ButtonBuilder,
    type ButtonInteraction,
    ButtonStyle,
    type ChatInputCommandInteraction,
    EmbedBuilder,
    escapeMarkdown,
    type Interaction,
    MessageFlags,
    ModalBuilder,
    type ModalSubmitInteraction,
    SlashCommandBuilder,
    TextInputBuilder,
    TextInputStyle,
} from "discord.js";
import { zAddCompetitiveMatch } from "../../../shared/types/competitive";
import { Command, hasOwnerPermission, honoClient } from "../utils";
import { sendNoPermissionMessage } from "./helpers";
import { readWhrResponse } from "./whr-api";

type Mode = "deathmatch" | "battle_royale";
type Team = { slugs: string[]; result: string };
type Session = {
    id: string;
    owner: string;
    guild: string;
    channel: string;
    mode: Mode;
    count: number;
    size: number;
    date: string;
    teams: Team[];
    draft?: Team;
    revision: number;
    expires: number;
    busy: boolean;
    frozen: boolean;
    saved?: { id: string };
    published: number;
    complete: boolean;
    winnerTeam?: number;
    winnerPage?: number;
};

const sessions = new Map<string, Session>();
const lifetime = 30 * 60 * 1000;
const allowedMentions = { parse: [] as never[] };
const modeName = (mode: Mode) => (mode === "deathmatch" ? "Deathmatch" : "Battle Royale");
function purgeExpired() {
    for (const [id, session] of sessions)
        if (!session.busy && session.expires <= Date.now()) sessions.delete(id);
}
setInterval(purgeExpired, 60000).unref();

function customId(session: Session, action: string) {
    return `whr-add:${session.id}:${session.revision}:${action}`;
}

function winnerCandidates(session: Session) {
    if (session.mode !== "deathmatch" || session.teams.length !== session.count)
        return [];
    return session.teams.map((_, i) => i);
}
function needsWinner(session: Session) {
    return session.winnerTeam === undefined && winnerCandidates(session).length > 1;
}

function winnerControls(session: Session) {
    const leaders = winnerCandidates(session);
    const start = (session.winnerPage ?? 0) * 15;
    const buttons = leaders.slice(start, start + 15).map((i) =>
        new ButtonBuilder()
            .setCustomId(customId(session, `winner-${i}`))
            .setLabel(`Team ${i + 1}: ${session.teams[i].slugs.join(" + ")}`.slice(0, 80))
            .setStyle(ButtonStyle.Primary),
    );
    const rows: ActionRowBuilder<ButtonBuilder>[] = [];
    for (let i = 0; i < buttons.length; i += 5)
        rows.push(
            new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(i, i + 5)),
        );
    const navigation = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(customId(session, "draw"))
            .setLabel("Draw - no winner")
            .setStyle(ButtonStyle.Secondary),
    );
    if (start > 0)
        navigation.addComponents(
            new ButtonBuilder()
                .setCustomId(customId(session, "winner-prev"))
                .setLabel("Previous teams")
                .setStyle(ButtonStyle.Secondary),
        );
    if (start + 15 < leaders.length)
        navigation.addComponents(
            new ButtonBuilder()
                .setCustomId(customId(session, "winner-next"))
                .setLabel("More teams")
                .setStyle(ButtonStyle.Secondary),
        );
    rows.push(
        navigation,
        new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(customId(session, "back"))
                .setLabel("Edit previous team")
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(customId(session, "cancel"))
                .setLabel("Cancel")
                .setStyle(ButtonStyle.Secondary),
        ),
    );
    return rows;
}
const winnerPrompt =
    "Who won the match? Select any team, even if they had fewer kills, or choose Draw. WHR still uses the entered scores. Your choice will be saved and posted publicly.";

function controls(session: Session) {
    if (!session.frozen && needsWinner(session)) return winnerControls(session);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(
                customId(
                    session,
                    session.saved || session.teams.length === session.count
                        ? "publish"
                        : "team",
                ),
            )
            .setLabel(
                session.saved
                    ? "Retry public post"
                    : session.teams.length === session.count
                      ? "Retry saving result"
                      : `Enter Team ${session.teams.length + 1}`,
            )
            .setStyle(ButtonStyle.Primary),
    );
    if (!session.frozen && session.teams.length)
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(customId(session, "back"))
                .setLabel("Edit previous team")
                .setStyle(ButtonStyle.Secondary),
        );
    if (!session.frozen)
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(customId(session, "cancel"))
                .setLabel("Cancel")
                .setStyle(ButtonStyle.Secondary),
        );
    return [row];
}

function teamModal(session: Session) {
    const number = session.teams.length + 1;
    const modal = new ModalBuilder()
        .setCustomId(customId(session, "submit"))
        .setTitle(`${modeName(session.mode)} - Team ${number}/${session.count}`);
    for (let player = 0; player < session.size; player++) {
        const input = new TextInputBuilder()
            .setCustomId(`player_${player}`)
            .setLabel(`Team ${number} Player ${player + 1} - game slug`)
            .setPlaceholder("Exact account slug from the game profile URL")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(100);
        if (session.draft?.slugs[player]) input.setValue(session.draft.slugs[player]);
        modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(input),
        );
    }
    const result = new TextInputBuilder()
        .setCustomId("result")
        .setLabel(
            `Team ${number} ${session.mode === "deathmatch" ? "score" : "finishing place"}`,
        )
        .setPlaceholder(
            session.mode === "deathmatch"
                ? "Score, e.g. 10 (0-1000)"
                : `Place, e.g. 1 for first (1-${session.count})`,
        )
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(4);
    if (session.draft?.result) result.setValue(session.draft.result);
    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(result));
    return modal;
}

function validateTeam(session: Session, team: Team) {
    const earlierSlugs = new Set(session.teams.flatMap((entry) => entry.slugs));
    if (team.slugs.some((slug) => !slug))
        throw new Error("Enter a game account slug for every player.");
    if (
        new Set(team.slugs).size !== team.slugs.length ||
        team.slugs.some((slug) => earlierSlugs.has(slug))
    )
        throw new Error(
            "A player cannot appear twice. Each player needs their own game account slug.",
        );
    const value = Number(team.result);
    if (
        !/^\d+$/.test(team.result) ||
        value > (session.mode === "deathmatch" ? 1000 : session.count) ||
        value < (session.mode === "deathmatch" ? 0 : 1)
    )
        throw new Error(
            session.mode === "deathmatch"
                ? "Enter a whole-number score from 0 to 1000."
                : `Enter a finishing place from 1 to ${session.count}.`,
        );
    if (
        session.mode === "battle_royale" &&
        session.teams.some((entry) => Number(entry.result) === value)
    )
        throw new Error(
            `Place ${value} is already assigned to another team. Each team needs a different finishing place.`,
        );
    if (
        session.mode === "deathmatch" &&
        session.teams.length === session.count - 1 &&
        value === 0 &&
        session.teams.every((entry) => Number(entry.result) === 0)
    )
        throw new Error(
            "At least one team must have a score greater than zero. Correct this score or edit the previous team.",
        );
}

function matchInput(session: Session) {
    if (needsWinner(session)) throw new Error("Choose the match winner or Draw first.");
    const ordered =
        session.mode === "battle_royale"
            ? [...session.teams].sort((a, b) => Number(a.result) - Number(b.result))
            : session.teams;
    return zAddCompetitiveMatch.parse({
        ...(session.winnerTeam != null ? { winnerTeam: session.winnerTeam } : {}),
        teams: ordered.map((team) => team.slugs),
        scores:
            session.mode === "deathmatch"
                ? ordered.map((team) => Number(team.result))
                : undefined,
        reference: `discord-${session.id}`,
        playedOn: session.date,
        note: "",
        executorId: session.owner,
        requestId: session.id,
    });
}

function scoreboard(session: Session) {
    const values = session.teams.map((team) => Number(team.result));
    const best =
        session.mode === "deathmatch" ? Math.max(...values) : Math.min(...values);
    const tied = session.winnerTeam === -1;
    const lines = session.teams.map((team, i) => {
        const winning =
            tied ||
            (session.winnerTeam !== undefined
                ? i === session.winnerTeam
                : values[i] === best);
        const result =
            session.mode === "deathmatch"
                ? `Score: ${values[i]}`
                : `Place: #${values[i]}`;
        return `**Team ${i + 1} - ${result}${winning ? (tied ? " (Draw)" : " (Winner)") : ""}**\n${team.slugs.map((slug) => escapeMarkdown(slug)).join(" + ")}`;
    });
    // Long slugs / large lobbies can exceed Discord's per-message embed limits.
    const pages = [""];
    for (const line of lines) {
        if (pages[pages.length - 1].length + line.length + 2 > 3500) pages.push("");
        pages[pages.length - 1] += `${line}\n\n`;
    }
    return pages.map((description, i) =>
        new EmbedBuilder()
            .setColor(0x83af50)
            .setTitle(
                `${modeName(session.mode)} result${pages.length > 1 ? ` (${i + 1}/${pages.length})` : ""}`,
            )
            .setDescription(description)
            .setFooter({
                text: `${session.date} UTC | Ratings updated | Match ID: ${session.saved!.id}`,
            }),
    );
}

async function saveAndPublish(
    interaction: ButtonInteraction | ModalSubmitInteraction,
    session: Session,
) {
    if (!session.saved) {
        const input = matchInput(session);
        // A lost response may still have committed. Retries must keep the same
        // payload as well as the same idempotency key.
        session.frozen = true;
        const response = await honoClient.competitive.add.$post(
            { json: input },
            { init: { signal: AbortSignal.timeout(120000) } },
        );
        if (response.status >= 400 && response.status < 500) session.frozen = false;
        session.saved = await readWhrResponse<{ id: string }>(response);
    }
    // Finish the private deferred response before sending public follow-ups.
    await interaction.editReply({
        content: "Result saved. Posting the scoreboard to this channel...",
        components: [],
        allowedMentions,
    });
    const pages = scoreboard(session);
    for (; session.published < pages.length; session.published++) {
        await interaction.followUp({
            embeds: [pages[session.published]],
            allowedMentions,
        });
    }
    session.complete = true;
    await interaction.editReply({
        content: "Result recorded and posted publicly in this channel.",
        components: [],
        allowedMentions,
    });
}

export const whrAddHandler = {
    command: new SlashCommandBuilder()
        .setName(Command.WhrAdd)
        .setDescription(
            "Enter a rated match using team and game-slug forms (owner role only)",
        )
        .addStringOption((option) =>
            option
                .setName("mode")
                .setDescription("Choose the match type")
                .setRequired(true)
                .addChoices(
                    { name: "Deathmatch", value: "deathmatch" },
                    { name: "Battle Royale", value: "battle_royale" },
                ),
        )
        .addIntegerOption((option) =>
            option
                .setName("teams")
                .setDescription("How many teams competed? (2-32)")
                .setRequired(true)
                .setMinValue(2)
                .setMaxValue(32),
        )
        .addIntegerOption((option) =>
            option
                .setName("players_per_team")
                .setDescription("How many players are on each team?")
                .setRequired(true)
                .addChoices(
                    ...[1, 2, 3, 4].map((value) => ({ name: String(value), value })),
                ),
        )
        .addStringOption((option) =>
            option
                .setName("date")
                .setDescription("Optional UTC match date: YYYY-MM-DD. Defaults to today.")
                .setMaxLength(10),
        ),
    async execute(interaction: ChatInputCommandInteraction) {
        if (!hasOwnerPermission(interaction)) {
            await sendNoPermissionMessage(interaction);
            return;
        }
        purgeExpired();
        const mode = interaction.options.getString("mode", true);
        const count = interaction.options.getInteger("teams", true);
        const size = interaction.options.getInteger("players_per_team", true);
        const date =
            interaction.options.getString("date") ??
            new Date().toISOString().slice(0, 10);
        if (
            (mode !== "deathmatch" && mode !== "battle_royale") ||
            !Number.isInteger(count) ||
            count < 2 ||
            count > 32 ||
            !Number.isInteger(size) ||
            size < 1 ||
            size > 4 ||
            !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
            !Number.isFinite(Date.parse(date)) ||
            new Date(date).toISOString().slice(0, 10) !== date ||
            date > new Date().toISOString().slice(0, 10)
        ) {
            await interaction.reply({
                content:
                    "Choose Deathmatch or Battle Royale, 2-32 teams, and 1-4 players per team. Use a valid date (YYYY-MM-DD), no later than today.",
                flags: MessageFlags.Ephemeral,
            });
            return;
        }
        if (sessions.size >= 200) {
            await interaction.reply({
                content:
                    "Too many match forms are open. Finish or cancel an existing form, then try again.",
                flags: MessageFlags.Ephemeral,
            });
            return;
        }
        const session: Session = {
            id: interaction.id,
            owner: interaction.user.id,
            guild: interaction.guildId!,
            channel: interaction.channelId,
            mode,
            count,
            size,
            date,
            teams: [],
            revision: 0,
            expires: Date.now() + lifetime,
            busy: false,
            frozen: false,
            published: 0,
            complete: false,
        };
        sessions.set(session.id, session);
        await interaction.showModal(teamModal(session));
    },
};

/** Routed before the slash-command handler; drafts are private to their staff author. */
export async function handleWhrAddInteraction(
    interaction: Interaction,
): Promise<boolean> {
    if (
        !(interaction.isButton() || interaction.isModalSubmit()) ||
        !interaction.customId.startsWith("whr-add:")
    )
        return false;
    if (!hasOwnerPermission(interaction)) {
        await sendNoPermissionMessage(interaction);
        return true;
    }
    purgeExpired();
    const [, id, revision, action] = interaction.customId.split(":");
    const session = sessions.get(id);
    const fail = async (content: string) => {
        await interaction.reply({
            content,
            flags: MessageFlags.Ephemeral,
            allowedMentions,
        });
    };
    if (!session) {
        await fail(
            "This form expired or the bot restarted. Run /whr_add to start again.",
        );
        return true;
    }
    if (
        session.owner !== interaction.user.id ||
        session.guild !== interaction.guildId ||
        session.channel !== interaction.channelId
    ) {
        await fail(
            "This match form belongs to another referee. Run /whr_add to enter your own result.",
        );
        return true;
    }
    if (session.complete || session.busy || String(session.revision) !== revision) {
        await fail(
            session.complete
                ? "This result has already been recorded and posted."
                : session.busy
                  ? "This result is still being processed. Please wait."
                  : "This step is out of date. Use the newest form buttons.",
        );
        return true;
    }
    session.expires = Date.now() + lifetime;
    session.busy = true;
    try {
        if (interaction.isButton()) {
            if (action === "cancel" && !session.frozen) {
                sessions.delete(id);
                await interaction.update({
                    content: "Match entry canceled. No result was saved.",
                    components: [],
                    allowedMentions,
                });
            } else if ((action === "team" || action === "back") && !session.frozen) {
                if (action === "back" && session.teams.length) {
                    session.draft = session.teams.pop();
                    session.winnerTeam = undefined;
                    session.winnerPage = 0;
                    session.revision++;
                }
                if (session.teams.length >= session.count)
                    throw new Error("All teams are already entered.");
                await interaction.showModal(teamModal(session));
            } else if (
                !session.frozen &&
                needsWinner(session) &&
                (action === "winner-prev" || action === "winner-next")
            ) {
                session.winnerPage = Math.max(
                    0,
                    Math.min(
                        Math.floor((winnerCandidates(session).length - 1) / 15),
                        (session.winnerPage ?? 0) + (action === "winner-next" ? 1 : -1),
                    ),
                );
                session.revision++;
                await interaction.update({
                    content: winnerPrompt,
                    components: controls(session),
                    allowedMentions,
                });
            } else if (
                !session.frozen &&
                needsWinner(session) &&
                (action === "draw" || /^winner-\d+$/.test(action))
            ) {
                const winner = action === "draw" ? -1 : Number(action.slice(7));
                if (winner !== -1 && !winnerCandidates(session).includes(winner))
                    throw new Error("Choose one of the participating teams.");
                session.winnerTeam = winner;
                session.revision++;
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                await saveAndPublish(interaction, session);
            } else if (action === "publish" && session.teams.length === session.count) {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                await saveAndPublish(interaction, session);
            } else await fail("Use the newest form buttons to continue.");
        } else if (
            action === "submit" &&
            !session.frozen &&
            session.teams.length < session.count
        ) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const team: Team = {
                slugs: Array.from({ length: session.size }, (_, i) =>
                    interaction.fields.getTextInputValue(`player_${i}`).trim(),
                ),
                result: interaction.fields.getTextInputValue("result").trim(),
            };
            session.draft = team;
            validateTeam(session, team);
            await readWhrResponse(
                await honoClient.competitive["validate-players"].$post(
                    { json: { slugs: team.slugs } },
                    { init: { signal: AbortSignal.timeout(15000) } },
                ),
            );
            session.teams.push(team);
            session.draft = undefined;
            session.revision++;
            if (needsWinner(session))
                await interaction.editReply({
                    content: winnerPrompt,
                    components: controls(session),
                    allowedMentions,
                });
            else if (session.teams.length === session.count)
                await saveAndPublish(interaction, session);
            else
                await interaction.editReply({
                    content: `Team ${session.teams.length} checked: ${team.slugs.map((slug) => escapeMarkdown(slug)).join(" + ")}\n${session.mode === "deathmatch" ? "Score" : "Finishing place"}: ${team.result}\nContinue with Team ${session.teams.length + 1}. The final result will be posted publicly.`,
                    components: controls(session),
                    allowedMentions,
                });
        } else await fail("Use the newest form buttons to continue.");
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Could not complete this step.";
        const payload = {
            content: `${session.saved ? "The result is saved, but the public post could not finish. Retry below; the result will not be recorded twice.\n" : ""}${escapeMarkdown(message).slice(0, 1300)}`,
            components: session.complete ? [] : controls(session),
            allowedMentions,
        };
        if (interaction.deferred || interaction.replied)
            await interaction.editReply(payload);
        else await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
    } finally {
        session.busy = false;
    }
    return true;
}
