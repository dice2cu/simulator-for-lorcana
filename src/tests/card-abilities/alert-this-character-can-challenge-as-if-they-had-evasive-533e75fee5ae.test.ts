import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
import { canChallenge } from "../../engine/actions";
// Converted from reference/card-abilities/alert-this-character-can-challenge-as-if-they-had-evasive-533e75fee5ae.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 533e75fee5ae
const abilityText = "Alert (This character can challenge as if they had Evasive.)";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Amos Slade - Tenacious Tracker",
    "Cri-Kee - Good Luck Charm",
    "Dr. Hamsterviel - Evil Observer",
    "Launchpad - Sky Patrol",
    "Napoleon - Patient Watchdog",
    "Sina - Vigilant Parent",
    "Syndrome - Evil Inventor",
    "Violet Parr - At Wits' End",
    "Gigi - Best in Snow",
    "Lexington - Small in Stature",
    "Lionheart - Cleaning Up the City",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        const scenarioRules = () => new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [{ definition: prototypeCardName, exerted: !true }]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [{ definition: "Tinker Bell - Peter Pan's Ally", exerted: !false }]);
        const attacker = playerAt(scenarioGame, 1).play[0];
        const evasiveDefender = playerAt(scenarioGame, 2).play[0];
        expect(canChallenge(scenarioRules(), attacker.card, evasiveDefender.card)).toBe(true);
    });
});
