import { describe, expect, it } from "vitest";
import { HeuristicBot } from "../../bot/heuristic-bot";
import { identities, rewind, TurnHistory } from "../../bot/history";
import type { Hypothesis } from "../../bot/insight";
import { Knowledge } from "../../bot/knowledge";
import { sampleFill } from "../../bot/sampling";
import { continueTurn, startTurn } from "../../engine/engine";
import { resumeTurn } from "../../engine/resume";
import type { GameStateView } from "../../model/game-state-view";
import type { CardIdentifier, PlayerNumber } from "../../model/identity";
import type { PlayerAnswer, PlayerController, PlayerRequest, PlayerUpdate } from "../../model/player-interaction";
import { SeededRandom } from "../../player/random";
import { playGame, type Seat } from "../../player/runner";
import { createBot } from "../../search/bots";
import { HypotheticalInsight, hypotheticalOptions, hypothesize, replayTurn } from "../../search/insight";
import { projectState, sight } from "../../player/projection";
import { referenceDecks } from "../fixtures/reference-decks";
import { list, Scenario } from "../bot/scenario";

const key = (card: CardIdentifier): string => `${card.fullName}#${card.i}`;

/** Follows updates the way a bot does, without deciding anything itself. */
class Follower {
    readonly knowledge: Knowledge;
    readonly history = new TurnHistory();
    readonly shown = new Set<string>();
    constructor(player: PlayerNumber, deck: Parameters<typeof createBot>[0]["deck"]) {
        this.knowledge = new Knowledge(player, deck);
    }
    observe(update: PlayerUpdate): void {
        this.knowledge.update(update);
        this.history.record(update, this.knowledge.all());
        for (const card of identities(update.state)) this.shown.add(key(card));
        for (const observation of update.observations)
            JSON.parse(JSON.stringify(observation), (_field, value) => {
                if (value && typeof value === "object" && typeof value.fullName === "string" && typeof value.i === "number") this.shown.add(key(value));
                return value;
            });
    }
}

describe("search-branch contract", () => {
    it("restores turn-local limits by replaying the visible turn, which a bare position loses", () => {
        const scenario = new Scenario({ hand: ["Go Go Tomago - Darting Dynamo", "Ursula - Deceiver", "Lady - Family Dog"] }, {});
        const deck = list("Go Go Tomago - Darting Dynamo", "Ursula - Deceiver", "Lady - Family Dog");
        const follower = new Follower(1, deck);
        let checked = false;
        const scripted: PlayerController = {
            observe: (update) => follower.observe(update),
            decide: (state: GameStateView, request: PlayerRequest): PlayerAnswer => {
                if (request.type !== "Action") throw new Error("Unexpected request");
                const ink = request.actions.find((entry) => entry.action.type === "Ink");
                if (ink) return { type: "Action", option: ink.option };
                const record = follower.history.turn!;
                const start = rewind(record)!;
                const replay = replayTurn(hypothesize(start), record.steps, 1, state);
                expect(replay).toBeDefined();
                const resumed = resumeTurn(hypothesize(start), replay!.prefix, hypotheticalOptions).request;
                const bare = continueTurn(hypothesize(state), hypotheticalOptions).request;
                const inks = (request: typeof bare) => (request?.type === "Action" ? request.actions.filter((action) => action.type === "Ink").length : -1);
                expect(inks(resumed)).toBe(0);
                expect(inks(bare)).toBeGreaterThan(0);
                const hypothesis: Hypothesis = { current: { view: state }, turn: { start: { view: start }, steps: record.steps } };
                expect(HypotheticalInsight.fromView(state, 1, hypothesis).replayed).toBe(true);
                checked = true;
                return { type: "Action", option: request.actions.find((entry) => entry.action.type === "End Turn")!.option };
            },
        };
        const seats: Seat[] = [
            { player: 1, deck, controller: scripted },
            { player: 2, deck: list(), controller: createBot({ player: 2, deck: list(), settings: { seed: 1, search: { nodes: 0, samples: 0 } } }) },
        ];
        playGame(seats, { seed: 1, from: scenario.state, turns: 1 });
        expect(checked).toBe(true);
    });

    it("falls back to the current position when a replay does not reproduce the view", () => {
        const scenario = new Scenario({ hand: ["Go Go Tomago - Darting Dynamo", "Ursula - Deceiver"], ink: 2 }, {});
        const state = startTurn(scenario.state).position!;
        const view = projectState(state, sight(state, 1));
        // The turn-start draw is known to its player, as rewinding its observation would place it.
        const top = scenario.state.players[1]!.deck[0];
        const sees = sight(scenario.state, 1);
        const start = projectState(scenario.state, (card) => sees(card) || key(card) === key(top));
        // The turn view claims an ink that never happened, so the replay disagrees with the view.
        const steps = [{ type: "Action" as const, action: { type: "Ink" as const, player: 1 as PlayerNumber, card: state.players[1]!.hand[0] } }];
        const insight = HypotheticalInsight.fromView(view, 1, { current: { view }, turn: { start: { view: start }, steps } });
        expect(insight.replayed).toBe(false);
        expect(HypotheticalInsight.fromView(view, 1, { current: { view }, turn: { start: { view: start }, steps: [] } }).replayed).toBe(true);
    });

    it("builds hypothetical starts only from identities the player was shown", () => {
        let checks = 0;
        for (let game = 0; game < 3; game++) {
            const decks = [referenceDecks[game * 2].cards, referenceDecks[game * 2 + 1].cards];
            const followers = decks.map((deck, i) => new Follower((i + 1) as PlayerNumber, deck));
            const bots = decks.map((deck, i) => createBot({ player: (i + 1) as PlayerNumber, deck, settings: { seed: game, search: { nodes: 0, samples: 0 } } }));
            const seats: Seat[] = bots.map((bot, i) => ({
                player: (i + 1) as PlayerNumber,
                deck: decks[i],
                controller: {
                    observe: (update) => {
                        followers[i].observe(update);
                        bot.observe(update);
                    },
                    decide: (state, request) => {
                        const record = followers[i].history.turn;
                        if (request.type === "Action" && state.turn.player === i + 1 && record) {
                            const start = rewind(record);
                            for (const card of start ? identities(start) : []) expect(followers[i].shown.has(key(card))).toBe(true);
                            checks++;
                        }
                        return bot.decide(state, request);
                    },
                },
            }));
            playGame(seats, { seed: game + 40 });
        }
        expect(checks).toBeGreaterThan(50);
    }, 120000);

    it("compares every candidate in the same sampled worlds, independent of difficulty", () => {
        const scenario = new Scenario({ hand: ["Go Go Tomago - Darting Dynamo", "Ursula - Deceiver", "Lady - Family Dog"], ink: 3, play: ["Pete - Games Referee"] }, { play: ["Kit Cloudkicker - Tough Guy"] });
        const deck = list("Go Go Tomago - Darting Dynamo", "Ursula - Deceiver", "Lady - Family Dog", "Pete - Games Referee");
        const run = (randomness: number) => {
            const worlds: { fill: string; calls: number }[][] = [];
            const factory = (view: GameStateView, viewer: PlayerNumber, hypothesis?: Hypothesis) => {
                const insight = HypotheticalInsight.fromView(view, viewer, hypothesis);
                if (!hypothesis?.current.fill) return insight;
                const entry = { fill: JSON.stringify(hypothesis.current.fill), calls: 0 };
                (worlds[worlds.length - 1] ??= []).push(entry);
                const simulate = insight.simulate.bind(insight);
                insight.simulate = (...args) => {
                    entry.calls++;
                    return simulate(...args);
                };
                return insight;
            };
            const bot = new HeuristicBot({ player: 1, deck, settings: { seed: 5, search: { nodes: 120, samples: 3 }, randomness } }, factory);
            const recorder: PlayerController = {
                observe: (update) => bot.observe(update),
                decide: (state, request) => {
                    if (request.type === "Action") worlds.push([]);
                    return bot.decide(state, request);
                },
            };
            playGame(
                [
                    { player: 1, deck, controller: recorder },
                    { player: 2, deck: list("Kit Cloudkicker - Tough Guy"), controller: createBot({ player: 2, deck: list("Kit Cloudkicker - Tough Guy"), settings: { seed: 1, search: { nodes: 0, samples: 0 } } }) },
                ],
                { seed: 2, from: scenario.state, turns: 1 },
            );
            return worlds.filter((entry) => entry.length);
        };
        const careful = run(0);
        expect(careful.length).toBeGreaterThan(0);
        for (const decision of careful) {
            expect(decision).toHaveLength(3);
            expect(new Set(decision.map((world) => world.calls)).size).toBe(1);
        }
        expect(careful[0][0].calls).toBeGreaterThan(1);
        // Difficulty uses its own stream, so the first decision samples the same worlds.
        expect(run(1)[0].map((world) => world.fill)).toEqual(careful[0].map((world) => world.fill));
    }, 60000);

    it("scores every explored line after the reply, however small the budget", () => {
        // Lines cut off at different points would compare positions from different moments of the game.
        const scenario = new Scenario({ hand: ["Go Go Tomago - Darting Dynamo", "Ursula - Deceiver", "Lady - Family Dog"], ink: 3, play: ["Pete - Games Referee"] }, { play: ["Kit Cloudkicker - Tough Guy"] });
        const deck = list("Go Go Tomago - Darting Dynamo", "Ursula - Deceiver", "Lady - Family Dog", "Pete - Games Referee");
        const timings: string[] = [];
        const factory = (view: GameStateView, viewer: PlayerNumber, hypothesis?: Hypothesis) => {
            const insight = HypotheticalInsight.fromView(view, viewer, hypothesis);
            const simulate = insight.simulate.bind(insight);
            insight.simulate = (action, cost, search) =>
                simulate(action, cost, {
                    ...search,
                    evaluate: (here, timing, winners) => {
                        timings.push(winners ? "decided" : `P${timing.player}${timing.starting ? " starting" : " acting"}`);
                        return search.evaluate(here, timing, winners);
                    },
                });
            return insight;
        };
        const bot = new HeuristicBot({ player: 1, deck, settings: { seed: 5, search: { nodes: 1, samples: 1 } } }, factory);
        playGame(
            [
                { player: 1, deck, controller: bot },
                { player: 2, deck: list("Kit Cloudkicker - Tough Guy"), controller: createBot({ player: 2, deck: list("Kit Cloudkicker - Tough Guy"), settings: { seed: 1, search: { nodes: 0, samples: 0 } } }) },
            ],
            { seed: 2, from: scenario.state, turns: 1 },
        );
        expect(timings.length).toBeGreaterThan(3);
        for (const timing of timings) expect(["P1 starting", "decided"]).toContain(timing);
    }, 60000);
});

describe("sampled hidden cards", () => {
    const view = (hand: GameStateView["players"][1]): GameStateView => ({
        turn: { number: 3, player: 1 },
        players: { 1: hand, 2: { lore: 0, turnsTaken: 1, deck: 10, hand: 3, play: [{ card: { fullName: "Pete - Games Referee", i: 90 } }], discard: [], inkwell: [] } },
    });
    const own = view({ lore: 0, turnsTaken: 1, deck: 6, hand: [{ fullName: "Ursula - Deceiver", i: 1 }], play: [], discard: [], inkwell: [] });
    const deck = [
        { fullName: "Ursula - Deceiver", count: 2 },
        { fullName: "Go Go Tomago - Darting Dynamo", count: 5 },
    ];

    it("draws names only from permitted lists, minus cards already placed", () => {
        const knowledge = new Knowledge(1, deck, { 2: { type: "Confirmed", cards: [{ fullName: "Pete - Games Referee", count: 4 }, { fullName: "Lady - Family Dog", count: 10 }] } });
        knowledge.update({ state: own, turn: { steps: [] }, observations: [] });
        const fill = sampleFill(own, knowledge.all(), new SeededRandom(1));
        expect(fill[1]!.hand).toEqual([]);
        expect([...fill[1]!.deck].sort()).toEqual([...Array<string>(5).fill("Go Go Tomago - Darting Dynamo"), "Ursula - Deceiver"].sort());
        expect(fill[2]!.hand).toHaveLength(3);
        expect(fill[2]!.deck).toHaveLength(10);
        const petes = [...fill[2]!.hand, ...fill[2]!.deck].filter((name) => name === "Pete - Games Referee").length;
        expect(petes).toBeLessThanOrEqual(3);
    });

    it("keeps placeholders without a list and leaves room outside an uncertain scouted list", () => {
        const none = new Knowledge(1, deck);
        none.update({ state: own, turn: { steps: [] }, observations: [] });
        expect(sampleFill(own, none.all(), new SeededRandom(1))[2]).toBeUndefined();
        const scouted = new Knowledge(1, deck, { 2: { type: "Scouted", cards: [{ fullName: "Lady - Family Dog", count: 13 }], confidence: 0.5 } });
        scouted.update({ state: own, turn: { steps: [] }, observations: [] });
        const fill = sampleFill(own, scouted.all(), new SeededRandom(1))[2]!;
        const sampled = fill.hand.length + fill.deck.length;
        expect(sampled).toBeGreaterThan(0);
        expect(sampled).toBeLessThan(13);
        expect(new Set([...fill.hand, ...fill.deck])).toEqual(new Set(["Lady - Family Dog"]));
    });
});
