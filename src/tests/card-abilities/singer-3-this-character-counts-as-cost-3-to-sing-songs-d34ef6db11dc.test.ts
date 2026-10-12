import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
// Converted from reference/card-abilities/singer-3-this-character-counts-as-cost-3-to-sing-songs-d34ef6db11dc.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: d34ef6db11dc
const abilityText = "Singer 3 (This character counts as cost 3 to sing songs.)";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Cinderella - Ballroom Sensation",
    "Angel - Siren Singer",
    "Meilin Lee - Lead Vocalist",
    "Minnie Mouse - Musical Artist",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        const scenarioRules = () => new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        const singer = playerAt(scenarioGame, 1).play[0];
        expect(scenarioRules().characteristic(singer.card, "Cost To Sing")).toBe(Math.max(scenarioRules().characteristic(singer.card, "Cost") ?? 0, 3));
    });
});
