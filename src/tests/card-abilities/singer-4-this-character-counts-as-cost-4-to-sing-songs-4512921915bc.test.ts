import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
// Converted from reference/card-abilities/singer-4-this-character-counts-as-cost-4-to-sing-songs-4512921915bc.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 4512921915bc
const abilityText = "Singer 4 (This character counts as cost 4 to sing songs.)";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Alan-a-Dale - Loyal Bard",
    "Miss Bianca - Rescue Aid Society Agent",
    "Powerline - Taking the Stage",
    "Sebastian - Court Composer",
    "Ursula - Vanessa",
    "Clawhauser - Front Desk Officer",
    "The Troubadour - Musical Narrator",
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
        expect(scenarioRules().characteristic(singer.card, "Cost To Sing")).toBe(Math.max(scenarioRules().characteristic(singer.card, "Cost") ?? 0, 4));
    });
});
