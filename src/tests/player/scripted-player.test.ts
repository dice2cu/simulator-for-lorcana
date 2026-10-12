import { describe, expect, it } from "vitest";
import { projectState, sight } from "../../player/projection";
import type { GameState } from "../../model/game-state";
import type { PlayerRequest } from "../../model/player-interaction";
import { ScriptedPlayer } from "./scripted-player";

const initial: GameState = {
    turn: { number: 1, player: 1 },
    players: { 1: { lore: 0, turnsTaken: 0, deck: [], hand: [], play: [], inkwell: [], discard: [] } },
};
const view = projectState(initial, sight(initial, 1));
const optional: PlayerRequest = { type: "Optional", player: 1, effect: { type: "Gain Lore", player: "You", amount: 1 } };
const end: PlayerRequest = { type: "Action", player: 1, actions: [{ option: 73, action: { type: "End Turn", player: 1 }, cost: [] }] };

describe("scripted player", () => {
    it("checks the request and view before answering, and retains observations", () => {
        const player = new ScriptedPlayer().on("Optional", (request, state) => {
            expect(request.effect).toEqual({ type: "Gain Lore", player: "You", amount: 1 });
            expect(state).toBe(view);
            return { type: "Decision", answer: { type: "Optional", accept: false } };
        });
        const update = { state: view, turn: { steps: [] }, observations: [] };
        player.observe(update);
        expect(player.decide(view, optional)).toEqual({ type: "Decision", answer: { type: "Optional", accept: false } });
        expect(player.updates).toEqual([update]);
        player.assertDone();
    });

    it("rejects unexpected requests instead of accepting forced or optional choices", () => {
        const player = new ScriptedPlayer();
        expect(() => player.decide(view, optional)).toThrow(/Unexpected request.*no more requests/);
        expect(() => player.decide(view, { type: "Choose Cards", player: 1, cards: [], min: 0, max: 0 })).toThrow(/Unexpected request/);
        expect(() => player.decide(view, { type: "Pay Cost", player: 1, optional: false, cost: [], ink: [], payments: [[]] })).toThrow(/Unexpected request/);
    });

    it("rejects out-of-order requests without consuming the expected step", () => {
        const player = new ScriptedPlayer().action((action) => action.type === "End Turn");
        expect(() => player.decide(view, optional)).toThrow(/Expected Action/);
        expect(player.decide(view, end)).toEqual({ type: "Action", option: 73 });
    });

    it("reports unused steps", () => {
        const player = new ScriptedPlayer().action((action) => action.type === "End Turn");
        expect(() => player.assertDone()).toThrow(/1 unused scripted request/);
        player.decide(view, end);
        player.assertDone();
    });

    it("fails on rejected answers instead of silently retrying with another step", () => {
        const player = new ScriptedPlayer().action((action) => action.type === "End Turn");
        expect(() => player.decide(view, end, "Unknown action option")).toThrow(/Scripted answer was rejected: Unknown action option/);
        player.decide(view, end);
    });

    it("requires a unique semantic action match and uses the offered option number", () => {
        const player = new ScriptedPlayer().action((action) => action.type === "End Turn");
        expect(() => player.decide(view, { ...end, actions: [] })).toThrow(/exactly one matching action, received 0/);
        expect(() => player.decide(view, { ...end, actions: [...end.actions, { ...end.actions[0], option: 19 }] })).toThrow(/received 2/);
        expect(player.decide(view, end)).toEqual({ type: "Action", option: 73 });
    });
});
