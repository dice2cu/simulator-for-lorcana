import { describe, expect, it } from "vitest";
import { analyzeDeck } from "../../bot/analysis";
import { evaluate, WIN } from "../../bot/evaluate";
import type { GameStateView, PlayerPositionView } from "../../model/game-state-view";
import { HypotheticalInsight } from "../../search/insight";
import { referenceDecks } from "../fixtures/reference-decks";

const strategy = analyzeDeck(referenceDecks[1].cards);

function seat(lore: number, rest: Partial<PlayerPositionView> = {}): PlayerPositionView {
    return { lore, turnsTaken: 5, deck: 20, hand: 3, play: [], discard: [], inkwell: [], ...rest };
}

/** Player 1 at 17 lore with an exerted three-lore character. Player 2 has an exerted Pete. */
const view: GameStateView = {
    turn: { number: 9, player: 2 },
    players: {
        1: seat(17, { hand: [], play: [{ card: { fullName: "Cri-Kee - Lucky Cricket", i: 1 }, exerted: true }] }),
        2: seat(4, { play: [{ card: { fullName: "Pete - Games Referee", i: 2 }, exerted: true }] }),
    },
};

describe("position evaluation", () => {
    const insight = HypotheticalInsight.fromView(view, 1);

    it("treats a quest that wins when the next turn starts as nearly decided", () => {
        const ours = evaluate(insight, 1, strategy, { player: 1, starting: true });
        expect(ours).toBeGreaterThan(WIN / 4);
        expect(evaluate(insight, 2, strategy, { player: 1, starting: true })).toBeLessThan(-WIN / 4);
    });

    it("does not count lore from exerted characters in the middle of a turn", () => {
        expect(Math.abs(evaluate(insight, 1, strategy, { player: 1, starting: false }))).toBeLessThan(WIN / 4);
        expect(Math.abs(evaluate(insight, 1, strategy, { player: 2, starting: true }))).toBeLessThan(WIN / 4);
    });

    it("still prefers the stronger position within a decided game", () => {
        const stronger = HypotheticalInsight.fromView({ ...view, players: { ...view.players, 2: seat(4, { hand: 0, play: [] }) } }, 1);
        const lost = evaluate(insight, 2, strategy, { player: 2, starting: true }, [1]);
        expect(lost).toBeLessThan(-WIN / 2);
        expect(evaluate(stronger, 2, strategy, { player: 2, starting: true }, [1])).toBeLessThan(lost);
    });
});
