import { describe, expect, it } from "vitest";
import { analyzeDeck } from "../../bot/analysis";
import { continueTurn } from "../../engine/engine";
import { projectState, sight } from "../../player/projection";
import { projectRequest } from "../../player/requests";
import { createBot } from "../../search/bots";
import type { Strategy } from "../../model/strategy";
import { referenceDecks } from "../fixtures/reference-decks";
import { referenceStrategies } from "../fixtures/reference-strategies";
import { FILLER, list, play, Scenario } from "./scenario";

/**
 * Decision benchmarks with independently reasoned expectations. Each position is
 * small enough to explain why the choice matters. Bots receive only their own
 * deck lists. Expectations check resulting cards, lore and outcomes.
 */
describe("strategy acceptance scenarios", () => {
    it("takes a favorable challenge after spending its ink on development", () => {
        const deck = referenceDecks.find((entry) => entry.name === "Emerald-Steel-Discard");
        if (!deck) throw new Error("Missing discard deck");
        const scenario = new Scenario(
            {
                play: ["The Muses - Proclaimers of Heroes", { card: "Beast - Tragic Hero", drying: true }],
                hand: ["Beast - Tragic Hero", "Diablo - Devoted Herald", "Pete - Space Pirate"],
                ink: 5,
            },
            {
                lore: 12,
                play: [
                    { card: "Mulan - Injured Soldier", exerted: true, damage: 2 },
                    { card: "Mulan - Injured Soldier", exerted: true, damage: 2 },
                    { card: "Bolt - Dependable Friend", exerted: true },
                    { card: "Bolt - Dependable Friend", drying: true },
                    { card: "Shere Khan - Menacing Predator", exerted: true },
                ],
            },
        );
        const position = scenario.state.players[1];
        if (!position) throw new Error("Missing player");
        // Beast was just paid for. Continue mid-turn without readying its ink or drying it.
        for (const ink of position.inkwell) ink.exerted = true;
        const live = continueTurn(scenario.state);
        const request = live.request;
        const rules = live.rules;
        if (!request || request.type !== "Action" || !rules) throw new Error("Expected an action");
        const sees = sight(scenario.state, 1);
        const state = projectState(scenario.state, sees);
        const projected = projectRequest(request, rules, sees, (count) => Array.from({ length: count }, (_, i) => i));
        const bot = createBot({ player: 1, deck: deck.cards, settings: { seed: 1, search: { nodes: 200, samples: 1 } } });
        bot.observe({ state, observations: [], turn: { steps: [] } });
        const step = projected.toStep(bot.decide(state, projected.request));
        expect(
            step.type === "Action" &&
                step.action.type === "Challenge" &&
                step.action.attacker.fullName === "The Muses - Proclaimers of Heroes" &&
                step.action.defender.fullName === "Mulan - Injured Soldier",
        ).toBe(true);
    }, 60000);

    it("takes a winning quest instead of developing", () => {
        const scenario = new Scenario(
            { lore: 18, play: ["Lady - Family Dog"], hand: ["Rapunzel - Gifted with Healing"], ink: 4 },
            { lore: 10, play: ["Pete - Games Referee"] },
        );
        const result = play(scenario, { 1: list("Lady - Family Dog", "Rapunzel - Gifted with Healing"), 2: list("Pete - Games Referee") });
        expect(result.record.outcome?.winners).toEqual([1]);
    }, 60000);

    it("finishes with several quests instead of taking tempting challenges", () => {
        // Three one-lore quests reach twenty. Each character could instead banish an exerted target.
        const scenario = new Scenario(
            { lore: 17, play: ["Mr. Smee - Bumbling Mate", "Pete - Games Referee", "Louis - Endearing Alligator"] },
            {
                lore: 12,
                play: [
                    { card: "Lady - Family Dog", exerted: true },
                    { card: "Kit Cloudkicker - Tough Guy", exerted: true },
                    { card: "Tramp - Enterprising Dog", exerted: true },
                ],
            },
        );
        const result = play(scenario, {
            1: list("Mr. Smee - Bumbling Mate", "Pete - Games Referee", "Louis - Endearing Alligator"),
            2: list("Lady - Family Dog", "Kit Cloudkicker - Tough Guy", "Tramp - Enterprising Dog"),
        });
        expect(result.record.outcome?.winners).toEqual([1]);
    }, 60000);

    it("removes an opposing quester that would win next turn", () => {
        // Questing for two cannot stop eighteen lore plus two. Dragon Fire can.
        const scenario = new Scenario(
            { lore: 5, play: ["Lady - Family Dog"], hand: ["Dragon Fire"], ink: 5 },
            { lore: 18, play: [{ card: "Lady - Family Dog", exerted: true }] },
        );
        const result = play(scenario, { 1: list("Lady - Family Dog", "Dragon Fire"), 2: list("Lady - Family Dog") });
        expect(result.final.players[2]!.play).toEqual([]);
        expect(result.record.outcome).toBeUndefined();
    }, 60000);

    it("develops a two-drop instead of passing, without discarding a card to Shift onto it", () => {
        // After inking Beast, Morph is the only affordable play. Diablo can then Shift onto it, but that
        // Shift costs a discarded action and turns three cards into one body.
        const hand = ["Morph - Space Goo", "Diablo - Devoted Herald", "Let the Storm Rage On", "Beast - Tragic Hero"];
        const scenario = new Scenario({ ink: 1, hand }, { play: ["Pete - Games Referee"] });
        const result = play(scenario, { 1: list(...hand), 2: list("Pete - Games Referee") });
        expect(scenario.find(result.final, 1, "Morph - Space Goo")?.zone).toBe("Play");
        expect(scenario.find(result.final, 1, "Let the Storm Rage On")?.zone).toBe("Hand");
    }, 60000);

    it("inks a spare expensive card to keep its only playable character", () => {
        const scenario = new Scenario({ ink: 1, hand: ["Go Go Tomago - Darting Dynamo", "Tramp - Street-Smart Dog"] }, { play: ["Pete - Games Referee"] });
        const result = play(scenario, { 1: list("Go Go Tomago - Darting Dynamo", "Tramp - Street-Smart Dog"), 2: list("Pete - Games Referee") });
        expect(scenario.find(result.final, 1, "Go Go Tomago - Darting Dynamo")?.zone).toBe("Play");
        expect(scenario.find(result.final, 1, "Tramp - Street-Smart Dog")?.zone).toBe("Inkwell");
    }, 60000);

    it("sings with the low-lore character and quests with the high-lore one", () => {
        // Without ink, the song is only available by singing. Kit forgoes one lore, Lady two.
        const deck = Array<string>(10).fill("Lady - Family Dog");
        const scenario = new Scenario({ play: ["Lady - Family Dog", "Kit Cloudkicker - Tough Guy"], hand: ["Friends on the Other Side"], deck, ink: 0 }, {});
        const result = play(scenario, { 1: list("Lady - Family Dog", "Kit Cloudkicker - Tough Guy", "Friends on the Other Side", ...deck), 2: list() });
        expect(scenario.find(result.final, 1, "Friends on the Other Side")?.zone).toBe("Discard");
        expect(result.final.players[1]!.lore).toBe(2);
        const sing = result.actions.find((action) => action.type === "Sing");
        expect(sing?.type === "Sing" && sing.singers.map((card) => card.fullName)).toEqual(["Kit Cloudkicker - Tough Guy"]);
    }, 60000);

    it("challenges an exerted lore engine it can banish and survive", () => {
        // Pete deals three to a two-willpower Lady and takes two of his three.
        const scenario = new Scenario({ play: ["Pete - Games Referee"] }, { lore: 10, play: [{ card: "Lady - Family Dog", exerted: true }] });
        const result = play(scenario, { 1: list("Pete - Games Referee"), 2: list("Lady - Family Dog") });
        expect(result.final.players[2]!.play).toEqual([]);
        expect(scenario.find(result.final, 1, "Pete - Games Referee")?.zone).toBe("Play");
    }, 60000);

    it("does not throw away a character in a challenge it cannot win", () => {
        // Happy deals two to a five-willpower Pluto and is banished by its one strength.
        const scenario = new Scenario({ play: ["Happy - Lively Knight"] }, { lore: 4, play: [{ card: "Pluto - Guard Dog", exerted: true }] });
        const result = play(scenario, { 1: list("Happy - Lively Knight"), 2: list("Pluto - Guard Dog") });
        expect(result.actions.some((action) => action.type === "Challenge")).toBe(false);
        expect(scenario.find(result.final, 1, "Happy - Lively Knight")?.zone).toBe("Play");
    }, 60000);

    it("keeps the Shift base its deck needs and inks the unrelated card", () => {
        // Dapper Rascal shifts onto any Tramp. Go Go has no partner in this list.
        const chernadog = referenceDecks.find((deck) => deck.name === "Amber-Emerald-Chernadog")!.cards;
        const scenario = new Scenario({ ink: 1, hand: ["Tramp - Enterprising Dog", "Go Go Tomago - Darting Dynamo"] }, { play: ["Pete - Games Referee"] });
        for (const strategy of [undefined, referenceStrategies["Amber-Emerald-Chernadog"]]) {
            const result = play(scenario, { 1: chernadog, 2: list("Pete - Games Referee") }, { 1: strategy ? { strategy } : {} });
            expect(scenario.find(result.final, 1, "Tramp - Enterprising Dog")?.zone).not.toBe("Inkwell");
            expect(scenario.find(result.final, 1, "Go Go Tomago - Darting Dynamo")?.zone).toBe("Inkwell");
        }
    }, 120000);

    it("follows a supplied plan's preservation where the generated plan has no preference", () => {
        // A supplied plan that values Go Go makes the same bot ink the other card.
        const deck = list("Go Go Tomago - Darting Dynamo", "Ursula - Deceiver");
        const scenario = new Scenario({ ink: 1, hand: ["Go Go Tomago - Darting Dynamo", "Ursula - Deceiver"] }, { play: ["Pete - Games Referee"] });
        const keepGoGo: Strategy = {
            ...analyzeDeck(deck),
            resources: { targetInk: 4, preserve: [{ cards: { name: "Go Go Tomago" }, importance: 1, copies: 1 }] },
        };
        const keepUrsula: Strategy = { ...analyzeDeck(deck), resources: { targetInk: 4, preserve: [{ cards: { name: "Ursula" }, importance: 1, copies: 1 }] } };
        const first = play(scenario, { 1: deck, 2: list("Pete - Games Referee") }, { 1: { strategy: keepGoGo } });
        const second = play(scenario, { 1: deck, 2: list("Pete - Games Referee") }, { 1: { strategy: keepUrsula } });
        expect(scenario.find(first.final, 1, "Ursula - Deceiver")?.zone).toBe("Inkwell");
        expect(scenario.find(second.final, 1, "Go Go Tomago - Darting Dynamo")?.zone).toBe("Inkwell");
    }, 120000);

    it("does not develop into an opposing win when it can remove the threat instead", () => {
        // Brawl answers the two-strength quester. Playing Rapunzel instead loses next turn.
        const scenario = new Scenario(
            { lore: 6, hand: ["Brawl", "Rapunzel - Gifted with Healing"], ink: 4 },
            { lore: 18, play: [{ card: "Lady - Family Dog", exerted: true }], deck: Array<string>(15).fill(FILLER) },
        );
        const result = play(scenario, { 1: list("Brawl", "Rapunzel - Gifted with Healing"), 2: list("Lady - Family Dog") }, {}, 2);
        expect(result.record.outcome?.winners).not.toEqual([2]);
        expect(scenario.find(result.final, 1, "Brawl")?.zone).toBe("Discard");
    }, 60000);
});
