import type { GameState } from "./game-state";
import type { Decision, DecisionAnswer, Turn } from "./turn";

/** A bookkeeping excerpt after playing Rapunzel, before choosing whom to heal. */
export const positionDuringChoice: GameState = {
    turn: { number: 7, player: 1 },
    players: {
        1: {
            lore: 5, turnsTaken: 3, deck: [], hand: [], discard: [], inkwell: [],
            play: [
                { card: { fullName: "Rapunzel - Gifted with Healing", i: 17 }, drying: true },
                { card: { fullName: "Hercules - Divine Hero", i: 4 }, damage: 2 },
            ],
        },
        2: { lore: 6, turnsTaken: 3, deck: [], hand: [], play: [], discard: [], inkwell: [] },
    },
};

/** Illustrative accepted prefix. The base position is separate from this record. */
export const turnDuringChoice: Turn = {
    steps: [
        { type: "Action", action: { type: "Play", player: 1, card: { fullName: "Rapunzel - Gifted with Healing", i: 17 } } },
        { type: "Decision", answer: { type: "Pay Cost", pay: true, payment: [
            { type: "Ink", player: 1, cards: [0, 1, 2, 3].map(i => ({ fullName: "Dinglehopper", i })) },
        ] } },
    ],
};

/** The engine exposes this request, but it is not written into the turn record. */
export const healingDecision: Decision = {
    type: "Choose Cards", player: 1, min: 1, max: 1,
    cards: [
        { fullName: "Rapunzel - Gifted with Healing", i: 17 },
        { fullName: "Hercules - Divine Hero", i: 4 },
    ],
};

export const healingAnswer: DecisionAnswer = {
    type: "Choose Cards", cards: [{ fullName: "Hercules - Divine Hero", i: 4 }],
};
