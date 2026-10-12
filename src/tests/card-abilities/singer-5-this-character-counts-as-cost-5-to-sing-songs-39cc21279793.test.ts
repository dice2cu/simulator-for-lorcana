import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
// Converted from reference/card-abilities/singer-5-this-character-counts-as-cost-5-to-sing-songs-39cc21279793.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 39cc21279793
const abilityText = "Singer 5 (This character counts as cost 5 to sing songs.)";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Gaston - Baritone Bully",
    "Gazelle - Pop Star",
    "Kanga - Hunny Bard",
    "Shanti - Village Girl",
    "4*Town - Hottest Band of the Year",
    "Ariel - Spectacular Singer",
    "Aurora - Waking Beauty",
    "Cinderella - Gentle and Kind",
    "Isabela Madrigal - Such a Lovely Voice",
    "Max Goof - Rockin' Teen",
    "Mirabel Madrigal - Hopeful Dreamer",
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
        expect(scenarioRules().characteristic(singer.card, "Cost To Sing")).toBe(Math.max(scenarioRules().characteristic(singer.card, "Cost") ?? 0, 5));
    });
});
