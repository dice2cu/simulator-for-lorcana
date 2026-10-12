import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
import { canChallenge } from "../../engine/actions";
// Converted from reference/card-abilities/this-character-can-challenge-ready-characters-8e1aa241ad90.test.ts
import { describe, expect, it } from "vitest";
import type { Ability } from "../../model/ability";
// Generated ability ID: 8e1aa241ad90
const abilityText = "This character can challenge ready characters.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Li Shang - Newly Promoted",
    "Namaari - Morning Mist",
    "Mulan - Charging Ahead",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        const scenarioRules = () => new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [
            {
                definition: scenarioCards.fixture({
                    fullName: "Ready Target",
                    names: ["Ready Target"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Villain"],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 8,
                    lore: 0,
                }),
                exerted: !true,
                damage: 1,
            },
        ]);
        const player = playerAt(scenarioGame, 1),
            source = playerAt(scenarioGame, 1).play[0],
            target = playerAt(scenarioGame, 2).play[0],
            ability: Ability = {
                type: "Static",
                rule: { type: "Modify Cards", cards: "Self", modifier: { permission: "Can Challenge Ready Characters" } },
                name: "I WON'T LET YOU DOWN",
            };
        expect(canChallenge(scenarioRules(), source.card, target.card)).toBe(true);
    });
});
