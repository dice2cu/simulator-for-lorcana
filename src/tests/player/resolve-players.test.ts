import { describe, expect, it } from "vitest";
import { startAction, startEffect, startTurn } from "../../engine/engine";
import type { GameState } from "../../model/game-state";
import { ScriptedPlayer } from "./scripted-player";
import { emptyPlayer, playerAt } from "./fixtures";
import { finished, resolvePlayers } from "./resolve-players";

const source = { fullName: "Dinglehopper", i: 1 };
function position(): GameState {
    return { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
}

describe("isolated resolutions with scripted players", () => {
    it("rejects unplanned mandatory payments instead of supplying a default", () => {
        const state = position();
        const ink = { fullName: "Dinglehopper", i: 2 };
        playerAt(state, 1).hand = [source];
        playerAt(state, 1).inkwell = [{ card: ink, exerted: false }];
        const live = startAction(state, { type: "Play", player: 1, card: source });
        expect(() => resolvePlayers(live, { 1: new ScriptedPlayer() })).toThrow(/Unexpected request/);
    });

    it("passes filtered ink handles to the controller and maps its explicit payment back", () => {
        const state = position();
        const ink = { fullName: "Magic Mirror", i: 2 };
        playerAt(state, 1).hand = [source];
        playerAt(state, 1).inkwell = [{ card: ink, exerted: false }];
        const player = new ScriptedPlayer().on("Pay Cost", (request, view) => {
            expect(view.players[1]?.inkwell).toEqual([{ exerted: false }]);
            expect(request.ink[0].cards).toEqual([{ hidden: 0 }]);
            expect(request.cost).toEqual([{ type: "Ink", amount: 1 }]);
            return { type: "Decision", answer: { type: "Pay Cost", pay: true, payment: [{ type: "Ink", player: 1, cards: request.ink[0].cards }] } };
        });
        const live = startAction(state, { type: "Play", player: 1, card: source });
        resolvePlayers(live, { 1: player });
        expect(playerAt(finished(live), 1).inkwell).toEqual([{ card: ink, exerted: true }]);
        expect(playerAt(finished(live), 1).play.map((state) => state.card)).toEqual([source]);
    });

    it("does not implicitly accept an optional instruction", () => {
        const live = startEffect(
            position(),
            { type: "Optional", effect: { type: "Gain Lore", player: "You", amount: 1 } },
            { card: source, player: 1, kind: "Ability" },
        );
        expect(() => resolvePlayers(live, { 1: new ScriptedPlayer() })).toThrow(/Unexpected request/);
    });

    it("requires an explicit random outcome and rejects unused outcomes", () => {
        const state = position();
        const first = { fullName: "Dinglehopper", i: 2 },
            second = { fullName: "Magic Mirror", i: 3 };
        playerAt(state, 1).deck = [first, second];
        const effect = { type: "Shuffle" as const, player: "You" as const };
        const missing = startEffect(state, effect, { card: source, player: 1, kind: "Ability" });
        expect(() => resolvePlayers(missing, {})).toThrow(/Unexpected randomness/);
        const live = startEffect(state, effect, { card: source, player: 1, kind: "Ability" });
        resolvePlayers(live, {}, { random: [{ type: "Shuffle", cards: [second, first] }] });
        expect(playerAt(finished(live), 1).deck).toEqual([second, first]);
        const complete = startEffect(position(), { type: "Gain Lore", player: "You", amount: 1 }, { card: source, player: 1, kind: "Ability" });
        expect(() => resolvePlayers(complete, {}, { random: [{ type: "Shuffle", cards: [] }] })).toThrow(/Unused scripted random/);
    });

    it("only pauses at the explicitly requested action boundary", () => {
        const live = startTurn(position());
        resolvePlayers(live, {}, { untilAction: true });
        expect(live.request?.type).toBe("Action");
        expect(finished(live, true).turn).toEqual({ number: 1, player: 1 });
        expect(() => finished(live)).toThrow(/did not finish/);
        expect(() => resolvePlayers(live, {})).toThrow(/No scripted controller/);
    });

    it("cannot use the action boundary to hide a missing decision", () => {
        const live = startEffect(
            position(),
            { type: "Optional", effect: { type: "Gain Lore", player: "You", amount: 1 } },
            { card: source, player: 1, kind: "Ability" },
        );
        expect(() => resolvePlayers(live, {}, { untilAction: true })).toThrow(/No scripted controller/);
    });

    it("does not retry or repair an invalid scripted answer", () => {
        const live = startEffect(
            position(),
            { type: "Optional", effect: { type: "Gain Lore", player: "You", amount: 1 } },
            { card: source, player: 1, kind: "Ability" },
        );
        const player = new ScriptedPlayer().on("Optional", () => ({ type: "Decision", answer: { type: "Choose Amount", amount: 1 } }));
        expect(() => resolvePlayers(live, { 1: player })).toThrow(/outstanding Optional/);
        expect(live.request?.type).toBe("Optional");
    });
});
