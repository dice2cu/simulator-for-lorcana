import { describe, expect, expectTypeOf, it } from "vitest";
import type { DeckKnowledge } from "../../model/bot";
import type { CardIdentifier } from "../../model/identity";
import type { PlayerAnswer, PlayerCard, PlayerController, PlayerRequest, PlayerUpdate, PlayerObservation } from "../../model/player-interaction";
import type { Bot, BotMemory, BotSetup } from "../../model/bot";
import type { TurnView, TurnStepView } from "../../model/turn-view";
import type { Strategy } from "../../model/strategy";
import type { CardState, GameState } from "../../model/game-state";
import type { CardStatePlayerView, GameStateView } from "../../model/game-state-view";

describe("player and bot model contracts", () => {
    it("keeps difficulty separate from strategy and allows deterministic simulation settings", () => {
        const simulation: BotSetup = {
            player: 1,
            deck: [{ fullName: "Merlin - Goat", count: 4 }],
            settings: { seed: 42, search: { nodes: 1000, samples: 8 }, randomness: 0 },
        };
        const easy: BotSetup = {
            ...simulation,
            settings: { seed: 42, search: { nodes: 0, samples: 0 }, randomness: 0.2 },
        };
        const defaultSettings: BotSetup["settings"] = { seed: 42, search: { nodes: 0, samples: 0 } };
        expect(simulation.settings.randomness).toBe(0);
        expect(easy.settings.randomness).toBe(0.2);
        expect(defaultSettings.randomness).toBeUndefined();
        expectTypeOf<Strategy>().not.toHaveProperty("randomness");
    });

    it("lets synchronous bots and asynchronous UIs use the same controller interface", async () => {
        const state: GameStateView = { turn: { number: 1, player: 1 }, players: {} };
        const request: PlayerRequest = {
            type: "Action",
            player: 1,
            actions: [{ option: 0, action: { type: "End Turn", player: 1 }, cost: [] }],
        };
        const answer: PlayerAnswer = { type: "Action", option: 0 };
        const bot: PlayerController = { observe: () => {}, decide: () => answer };
        const ui: PlayerController = { observe: async () => {}, decide: async () => answer };

        const direct = bot.decide(state, request);
        expect(direct).not.toBeInstanceOf(Promise);
        expect(direct).toEqual(answer);
        await ui.observe({ state, turn: { steps: [] }, observations: [] });
        expect(await ui.decide(state, request)).toEqual(answer);
        expectTypeOf<Bot>().toExtend<PlayerController>();
        expectTypeOf<PlayerController>().not.toHaveProperty("memory");
    });

    it("keeps redacted turn history separate from live requests and answers", () => {
        const turn: TurnView = {
            steps: [{ type: "Random", outcome: { type: "Shuffle" } }, { type: "Decision" }, { type: "Action", action: { type: "End Turn", player: 1 } }],
        };
        type Random = Extract<TurnStepView, { type: "Random" }>;
        expectTypeOf<Extract<Random["outcome"], { type: "Shuffle" }>>().not.toHaveProperty("cards");
        expect(JSON.stringify(turn)).not.toContain("reference");
        expect(turn.steps[1]).toEqual({ type: "Decision" });
    });

    it("keeps GameState fields and hides identities without introducing computed card values", () => {
        const card: CardIdentifier = { fullName: "Merlin - Goat", i: 17 };
        const view: GameStateView = {
            turn: { number: 3, player: 1 },
            players: {
                1: {
                    lore: 2,
                    turnsTaken: 1,
                    deck: 50,
                    hand: [card],
                    play: [],
                    discard: [],
                    inkwell: [{ exerted: true }, { exerted: false }],
                },
                2: {
                    lore: 1,
                    turnsTaken: 1,
                    deck: [card, null, null],
                    hand: 5,
                    play: [],
                    discard: [],
                    inkwell: [],
                },
            },
        };
        const publicCard: CardState = {
            card,
            damage: 1,
            modifiers: [{ stat: "Strength", amount: -2, expires: { endOfTurn: 3 } }],
        };
        const inPlay: CardStatePlayerView = { ...publicCard, under: [{ faceDown: true }] };

        expectTypeOf<GameStateView["turn"]>().toEqualTypeOf<GameState["turn"]>();
        expectTypeOf<CardStatePlayerView["modifiers"]>().toEqualTypeOf<CardState["modifiers"]>();
        expectTypeOf<CardStatePlayerView>().not.toHaveProperty("strength");
        expectTypeOf<GameStateView>().not.toHaveProperty("resolving");
        expect(inPlay.modifiers).toEqual(publicCard.modifiers);
        expect(view.players[1]?.inkwell).toEqual([{ exerted: true }, { exerted: false }]);
        expect(view.players[2]?.deck).toEqual([card, null, null]);
    });

    it("keeps normal action identifiers and allows hidden handles only in card choices and payments", () => {
        type Actions = Extract<PlayerRequest, { type: "Action" }>["actions"][number]["action"];
        type Choices = Extract<PlayerRequest, { type: "Choose Cards" }>;
        type PaymentAnswer = Extract<Extract<PlayerAnswer, { type: "Decision" }>["answer"], { type: "Pay Cost"; pay: true }>;
        type InkPayment = Extract<PaymentAnswer["payment"][number], { type: "Ink" }>;

        expectTypeOf<Extract<Actions, { type: "Quest" }>["card"]>().toEqualTypeOf<CardIdentifier>();
        expectTypeOf<Choices["cards"]>().toEqualTypeOf<readonly PlayerCard[]>();
        expectTypeOf<InkPayment["cards"]>().toEqualTypeOf<readonly PlayerCard[]>();
        expectTypeOf<CardIdentifier>().toExtend<PlayerCard>();
        expectTypeOf<{ hidden: number }>().toExtend<PlayerCard>();
    });

    it("keeps engine registry and event slots out of action and trigger choices", () => {
        type Actions = Extract<PlayerRequest, { type: "Action" }>["actions"][number]["action"];
        type Trigger = Extract<PlayerRequest, { type: "Choose Trigger" }>["options"][number];
        type Replacement = Extract<PlayerRequest, { type: "Choose Replacement" }>["options"][number];
        expectTypeOf<Extract<Actions, { type: "Activate" | "Boost" }>>().not.toHaveProperty("rule");
        expectTypeOf<Extract<Actions, { type: "Shift" }>>().not.toHaveProperty("rule");
        expectTypeOf<Trigger>().not.toHaveProperty("reference");
        expectTypeOf<Replacement>().not.toHaveProperty("reference");
        const request: PlayerRequest = {
            type: "Choose Trigger",
            player: 1,
            options: [{ option: 0, player: 1, effect: { type: "Draw", player: "You", amount: 1 } }],
        };
        const answer: PlayerAnswer = { type: "Decision", answer: { type: "Choose Trigger", option: 0 } };
        expect(JSON.stringify(request)).not.toContain("reference");
        expect(answer.answer).toEqual({ type: "Choose Trigger", option: 0 });
    });

    it("delivers turn history and outcomes, and lets a UI receive a rejected-answer message", () => {
        const state: GameStateView = { turn: { number: 1, player: 1 }, players: {} };
        const updates: PlayerUpdate[] = [];
        const errors: (string | undefined)[] = [];
        const controller: PlayerController = {
            observe: (update) => {
                updates.push(update);
            },
            decide: (_state, _request, error) => {
                errors.push(error);
                return { type: "Action", option: 0 };
            },
        };
        const request: PlayerRequest = { type: "Action", player: 1, actions: [{ option: 0, action: { type: "End Turn", player: 1 }, cost: [] }] };
        controller.observe({ state, turn: { steps: [] }, observations: [], outcome: { winners: [1], eliminated: [], reason: "Lore" } });
        controller.decide(state, request, "Choose an available option");
        expect(updates[0]?.outcome?.winners).toEqual([1]);
        expect(errors).toEqual(["Choose an available option"]);
    });

    it("describes ordered deck movement without exposing hidden identities", () => {
        const card: CardIdentifier = { fullName: "Merlin - Goat", i: 17 };
        const observation: PlayerObservation = {
            type: "Move Cards",
            from: { player: 2, zone: "Deck", position: { from: "Top", index: 0 } },
            to: { player: 2, zone: "Deck", position: { from: "Bottom", index: 1 } },
            cards: [card, null],
        };
        expect(observation.to.position).toEqual({ from: "Bottom", index: 1 });
        expect(observation.cards).toEqual([card, null]);
    });

    it("stores derived knowledge and uncertainty without requiring an observation log", () => {
        const memory: BotMemory = {
            players: {
                1: {
                    observedColors: ["Amethyst"],
                    seenCards: [],
                    hand: [],
                    inkwell: [],
                    deckTop: [],
                    deckBottom: [],
                    remainingDeck: [{ fullName: "Merlin - Goat", min: 2, max: 3 }],
                    unlistedDeck: { min: 0, max: 48 },
                },
            },
            strategy: {
                priorities: { lore: 3, boardControl: 2, cards: 2, ink: 1, development: 3 },
                resources: { targetInk: 6, preserve: [] },
                synergies: [],
                caution: 0.3,
            },
        };
        expect(memory.players[1]?.remainingDeck[0]).toEqual({ fullName: "Merlin - Goat", min: 2, max: 3 });
        expectTypeOf<BotMemory>().not.toHaveProperty("observations");
    });

    it("does not let a bot choose actual random outcomes", () => {
        expectTypeOf<Extract<PlayerRequest, { type: "Shuffle" | "Random Cards" }>>().toEqualTypeOf<never>();
        expectTypeOf<Extract<PlayerAnswer, { type: "Random" }>>().toEqualTypeOf<never>();
    });

    it("can describe hidden choices without card identities", () => {
        const request: PlayerRequest = {
            type: "Choose Cards",
            player: 1,
            cards: [{ hidden: 0 }, { hidden: 1 }],
            min: 1,
            max: 1,
        };
        const answer: PlayerAnswer = {
            type: "Decision",
            answer: { type: "Choose Cards", cards: [{ hidden: 1 }] },
        };
        expect(JSON.stringify(request)).not.toContain("fullName");
        expect(JSON.stringify(answer)).not.toContain("fullName");
    });

    it("uses a visible card identifier directly without another wrapper", () => {
        const card: CardIdentifier = { fullName: "Merlin - Goat", i: 17 };
        const request: PlayerRequest = { type: "Choose Cards", player: 1, cards: [card], min: 1, max: 1 };
        const answer: PlayerAnswer = { type: "Decision", answer: { type: "Choose Cards", cards: [card] } };
        expect(request.cards).toEqual([card]);
        if (answer.answer.type !== "Choose Cards") throw new Error("Expected a card selection");
        expect(answer.answer.cards).toEqual([card]);
    });

    it("offers unidentified ready ink and accepts a payment using those handles", () => {
        const request: PlayerRequest = {
            type: "Pay Cost",
            player: 1,
            cost: [{ type: "Ink", amount: 2 }],
            optional: false,
            ink: [{ player: 1, cards: [{ hidden: 0 }, { hidden: 1 }, { hidden: 2 }], inkDrops: 0 }],
            payments: [[{ type: "Ink", player: 1, cards: [{ hidden: 0 }, { hidden: 1 }] }]],
        };
        const answer: PlayerAnswer = {
            type: "Decision",
            answer: { type: "Pay Cost", pay: true, payment: [{ type: "Ink", player: 1, cards: [{ hidden: 0 }, { hidden: 2 }] }] },
        };
        expect(request.ink[0]?.cards).toHaveLength(3);
        expect(JSON.stringify(answer)).not.toContain("fullName");
    });

    it("keeps scouting confidence separate from confirmed composition", () => {
        const cards = [{ fullName: "Merlin - Goat", count: 4 }];
        const confirmed: DeckKnowledge = { type: "Confirmed", cards };
        const scouted: DeckKnowledge = { type: "Scouted", cards, confidence: 0.8 };
        expect(confirmed.type).toBe("Confirmed");
        expect(scouted.confidence).toBe(0.8);
        expectTypeOf<Extract<DeckKnowledge, { type: "Confirmed" }>>().not.toHaveProperty("confidence");
    });

    it("supports a readable supplied strategy without a deck-name branch", () => {
        const strategy: Strategy = {
            priorities: { lore: 3, boardControl: 2, cards: 2, ink: 1, development: 3 },
            resources: { targetInk: 6, preserve: [] },
            synergies: [],
            caution: 0.3,
        };
        expect(JSON.parse(JSON.stringify(strategy))).toEqual(strategy);
    });

    it("lets custom strategies handle a card combination and delegate other requests", () => {
        // Illustrative preference, not a complete Mim/Merlin policy.
        const strategy: Strategy = {
            priorities: { lore: 3, boardControl: 2, cards: 2, ink: 1, development: 3 },
            resources: { targetInk: 6, preserve: [] },
            synergies: [],
            caution: 0.3,
            choose(state, request) {
                if (request.type !== "Action") return undefined;
                const goatInPlay = state.players[request.player]?.play.some(card => card.card.fullName === "Merlin - Goat");
                if (!goatInPlay) return undefined;
                const playMim = request.actions.find(({ action }) => action.type === "Play" && action.card.fullName === "Madam Mim - Snake");
                return playMim ? { type: "Action", option: playMim.option } : undefined;
            },
        };
        const state: GameStateView = {
            turn: { number: 5, player: 1 },
            players: {
                1: {
                    lore: 4, turnsTaken: 2, deck: 40,
                    hand: [{ fullName: "Madam Mim - Snake", i: 12 }],
                    play: [{ card: { fullName: "Merlin - Goat", i: 23 }, damage: 0 }],
                    discard: [], inkwell: [],
                },
            },
        };
        const request: PlayerRequest = {
            type: "Action", player: 1,
            actions: [
                { option: 7, action: { type: "Play", player: 1, card: { fullName: "Madam Mim - Snake", i: 12 } }, cost: [{ type: "Ink", amount: 2 }] },
                { option: 9, action: { type: "End Turn", player: 1 }, cost: [] },
            ],
        };
        const choose = strategy.choose;
        if (!choose) throw new Error("Expected custom decision logic");
        expect(choose(state, request)).toEqual({ type: "Action", option: 7 });
        expect(choose({ ...state, players: {} }, request)).toBeUndefined();
        expect(choose(state, { type: "Choose Amount", player: 1, min: 0, max: 2 })).toBeUndefined();
        expect(choose(state, { ...request, actions: [request.actions[1]] })).toBeUndefined();
    });

    it("describes alternate Shift prices and granted activations without engine references", () => {
        const card = { fullName: "Example character", i: 17 };
        const base = { fullName: "Example base", i: 28 };
        const request: PlayerRequest = {
            type: "Action",
            player: 1,
            actions: [
                { option: 0, action: { type: "Shift", player: 1, card, onto: [base], ability: 0 }, cost: [{ type: "Ink", amount: 3 }] },
                { option: 1, action: { type: "Shift", player: 1, card, onto: [base], ability: 0 }, cost: [{ type: "Ink", amount: 1 }] },
                {
                    option: 2,
                    action: { type: "Activate", player: 1, card, definition: { type: "Activated", cost: [], effect: { type: "Draw", player: "You", amount: 1 } } },
                    cost: [],
                },
                { option: 3, action: { type: "Boost", player: 1, card, definition: { name: "Boost", cost: [{ type: "Ink", amount: 2 }] } }, cost: [{ type: "Ink", amount: 2 }] },
            ],
        };
        expect(request.actions[0]?.cost).not.toEqual(request.actions[1]?.cost);
        const activation = request.actions[2]?.action;
        if (activation?.type !== "Activate") throw new Error("Expected activation");
        expect(activation.ability).toBeUndefined();
        expect(activation.definition.effect).toEqual({ type: "Draw", player: "You", amount: 1 });
        type Action = Extract<PlayerRequest, { type: "Action" }>["actions"][number]["action"];
        expectTypeOf<Extract<Action, { type: "Play" | "Move" | "Shift" }>>().not.toHaveProperty("alternateCost");
    });

    it("uses top-first order for a bottom group and points the index at its first card", () => {
        const a = { fullName: "A", i: 17 };
        const b = { fullName: "B", i: 28 };
        const deck = [{ fullName: "Existing top", i: 39 }, a, b];
        const observation: PlayerObservation = {
            type: "Move Cards",
            from: { player: 1, zone: "Hand" },
            to: { player: 1, zone: "Deck", position: { from: "Bottom", index: 1 } },
            cards: [a, b],
        };
        const position = observation.to.position;
        if (!position) throw new Error("Expected an ordered destination");
        const start = deck.length - 1 - position.index;
        expect(deck[start]).toEqual(observation.cards[0]);
        expect(deck.slice(start)).toEqual(observation.cards);
        expect(deck.at(-1)).toEqual(b);
    });

    it("retains known ink and allows unnamed composition outside a supplied list", () => {
        const memory: BotMemory = {
            players: {
                2: {
                    deck: { type: "Scouted", cards: [{ fullName: "Expected", count: 4 }], confidence: 0.5 },
                    observedColors: [], seenCards: [], hand: [],
                    inkwell: [{ fullName: "Unexpected", i: 42 }],
                    deckTop: [], deckBottom: [],
                    remainingDeck: [{ fullName: "Expected", min: 0, max: 4 }, { fullName: "Unexpected", min: 0, max: 3 }],
                    unlistedDeck: { min: 43, max: 50 },
                },
            },
            strategy: { priorities: { lore: 1, boardControl: 1, cards: 1, ink: 1, development: 1 }, resources: { targetInk: 6, preserve: [] }, synergies: [], caution: 0.5 },
        };
        expect(memory.players[2]?.inkwell[0]?.fullName).toBe("Unexpected");
        expect(memory.players[2]?.unlistedDeck.max).toBe(50);
    });

    it("can notify an eliminated seat before the multiplayer game ends", () => {
        const update: PlayerUpdate = {
            state: { turn: { number: 8, player: 2 }, players: {} },
            turn: { steps: [] }, observations: [],
            outcome: { winners: [], eliminated: [3], reason: "Empty Deck" },
        };
        expect(update.outcome?.eliminated).toEqual([3]);
        expect(update.outcome?.winners).toEqual([]);
    });

    it("records a public trigger choice without a historical request option or engine slot", () => {
        const observation: PlayerObservation = { type: "Choose Trigger", player: 2, effect: { type: "Draw", player: "You", amount: 1 } };
        expect(observation.effect.type).toBe("Draw");
        expectTypeOf<typeof observation>().not.toHaveProperty("option");
        expectTypeOf<typeof observation>().not.toHaveProperty("reference");
    });
});
