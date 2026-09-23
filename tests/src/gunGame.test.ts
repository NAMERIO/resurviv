import { expect, test, vi } from "vitest";
import { TeamMode } from "../../shared/gameConfig";
import { LeaderboardMsg, MsgStream, MsgType } from "../../shared/net/net";
import { createGame } from "./gameTestHelpers";

test.each([
    8, 16, 80,
])("Gun Game sends the full leaderboard on joining a %i-player lobby", async (count) => {
    const game = await createGame(TeamMode.Solo, "test_normal", {
        miniGame: "gun_game",
    });
    const players = Array.from({ length: count }, (_, i) =>
        game.playerBarn.addTestPlayer({
            name: `Player${i}`.padEnd(16, "x"),
        }),
    );
    const expected = game.gunGameManager.getLeaderboard().players;
    expect(expected).toHaveLength(count);

    for (const player of players) {
        const sendData = vi.spyOn(player, "sendData").mockImplementation(() => {});
        expect(() => player.sendMsgs()).not.toThrow();
        const packet = sendData.mock.calls
            .map(([buffer]) => buffer)
            .find((buffer) => buffer[0] === MsgType.Leaderboard);
        expect(packet).toBeDefined();
        const stream = new MsgStream(packet!);
        expect(stream.deserializeMsgType()).toBe(MsgType.Leaderboard);
        const received = new LeaderboardMsg();
        received.deserialize(stream.getStream());
        expect(received.players).toEqual(expected);
        sendData.mockRestore();
    }
});
