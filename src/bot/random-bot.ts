import type { GameStateView } from "../model/game-state-view";
import type { DeckListEntry, PlayerAnswer, PlayerController, PlayerDecisionAnswer, PlayerRequest, PlayerUpdate } from "../model/player-interaction";
import { SeededRandom } from "../player/random";
import { printedNames } from "./analysis";
import { fitChoice } from "./choice";

/**
 * Seeded uniform choices for runner and leak tests. Not a strategy. It ends a
 * turn with a fixed probability so repeatable free actions cannot stall a game.
 */
export class RandomBot implements PlayerController {
    private readonly random: SeededRandom;
    private readonly names: string[];

    constructor(setup: { readonly deck: readonly DeckListEntry[]; readonly seed: number }) {
        this.random = new SeededRandom(setup.seed);
        this.names = setup.deck.flatMap((entry) => printedNames(entry.fullName));
    }

    observe(_update: PlayerUpdate): void {}

    decide(_state: GameStateView, request: PlayerRequest): PlayerAnswer {
        if (request.type === "Action") {
            const end = request.actions.find((entry) => entry.action.type === "End Turn");
            const others = request.actions.filter((entry) => entry.action.type !== "End Turn");
            const pick = end && (!others.length || this.random.next() < 0.15) ? end : others[this.random.int(others.length)];
            return { type: "Action", option: pick.option };
        }
        return { type: "Decision", answer: this.answer(request) };
    }

    private answer(request: Exclude<PlayerRequest, { type: "Action" }>): PlayerDecisionAnswer {
        const random = this.random;
        switch (request.type) {
            case "Choose Cards": {
                const max = Math.min(request.max, request.cards.length);
                const count = request.min + random.int(Math.max(0, max - request.min) + 1);
                return { type: request.type, cards: fitChoice(request, random.shuffle(request.cards), count) };
            }
            case "Order Cards":
                return { type: request.type, cards: random.shuffle(request.cards) };
            case "Choose Player":
                return { type: request.type, player: request.players[random.int(request.players.length)] };
            case "Choose Mode":
                return { type: request.type, mode: request.options[random.int(request.options.length)].mode };
            case "Choose Amount":
                return { type: request.type, amount: request.min + random.int(request.max - request.min + 1) };
            case "Choose Trigger":
            case "Choose Replacement":
                return { type: request.type, option: request.options[random.int(request.options.length)].option };
            case "Pay Cost":
                if (!request.payments.length || (request.optional && random.next() < 0.2)) return { type: request.type, pay: false };
                return { type: request.type, pay: true, payment: request.payments[random.int(request.payments.length)] };
            case "Optional":
            case "Optional Cost Rule":
                return { type: request.type, accept: random.next() < 0.5 };
            case "Name Card":
                return { type: request.type, name: this.names[random.int(this.names.length)] };
            case "Distribute Damage Removal": {
                let left = request.max;
                const amounts = request.cards.map((entry) => {
                    const amount = Math.min(left, entry.max);
                    left -= amount;
                    return { card: entry.card, amount };
                });
                return { type: request.type, amounts };
            }
        }
    }
}
