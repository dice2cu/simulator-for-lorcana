import { describe, expect, it } from "vitest";
import { continueTurn, startTurn } from "../../engine/engine";
import type { GameState } from "../../model/game-state";

const card = (fullName: string, i: number) => ({ fullName, i });

function position(): GameState {
    return {
        turn: { number: 5, player: 1 },
        players: {
            1: {
                lore: 0,
                turnsTaken: 2,
                deck: [card("Pete - Games Referee", 1), card("Pete - Games Referee", 2)],
                hand: [card("Lady - Family Dog", 3), card("Ursula - Deceiver", 4)],
                play: [{ card: card("Kit Cloudkicker - Tough Guy", 5), exerted: true }],
                discard: [],
                inkwell: [{ card: card("Pete - Games Referee", 6), exerted: true }],
            },
            2: { lore: 0, turnsTaken: 2, deck: [card("Pete - Games Referee", 7)], hand: [], play: [], discard: [], inkwell: [] },
        },
    };
}

describe("continueTurn", () => {
    it("asks for the next intention without readying or drawing", () => {
        const live = continueTurn(position());
        expect(live.request?.type).toBe("Action");
        expect(live.position).toEqual(position());
        const started = startTurn(position()).position!;
        expect(started.players[1]!.hand).toHaveLength(3);
        expect(started.players[1]!.play[0].exerted).toBe(false);
    });

    it("starts without turn history, so an ink already made this turn is not remembered", () => {
        const turn = startTurn(position());
        const ink = turn.request?.type === "Action" ? turn.request.actions.find((action) => action.type === "Ink") : undefined;
        turn.submit({ type: "Action", action: ink! });
        const after = turn.position!;
        const again = (request: typeof turn.request) => (request?.type === "Action" ? request.actions.some((action) => action.type === "Ink") : false);
        expect(again(turn.request)).toBe(false);
        expect(again(continueTurn(after).request)).toBe(true);
    });

    it("ends the turn as usual", () => {
        const live = continueTurn(position());
        live.submit({ type: "Action", action: { type: "End Turn", player: 1 } });
        expect(live.result?.turn).toEqual({ number: 6, player: 2 });
        expect(live.result?.players[1]!.turnsTaken).toBe(3);
    });
});
