import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, inPlay } from "../player/fixtures";
// Converted from reference/card-abilities/this-location-gets-1-for-each-character-here-eb32f149a6aa.test.ts
import { describe, expect, it } from "vitest";
import type { Ability } from "../../model/ability";
// Generated ability ID: eb32f149a6aa
const abilityText = "This location gets +1 ◊ for each character here.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "White Agony Plains - Golden Lagoon",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        const scenarioRules = () => new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            prototypeCardName,
            {
                definition: scenarioCards.fixture({
                    fullName: "Knight",
                    names: ["Knight"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Knight"],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
            },
        ]);
        const player = playerAt(scenarioGame, 1),
            source = playerAt(scenarioGame, 1).play[0],
            other = playerAt(scenarioGame, 1).play[1];
        const second = (() => {
            const card = scenarioCards.create(scenarioCards.definition("Mickey Mouse - True Friend"));
            playerAt(scenarioGame, 1).play.push({ card, damage: 0, exerted: false, drying: false });
            return card;
        })();
        inPlay(scenarioRules(), second).location = source.card;
        other.location = source.card;
        const ability: Ability = {
            type: "Static",
            rule: {
                type: "Modify Cards",
                cards: "Self",
                modifier: { stat: "Lore", amount: { multiply: [1, { count: { zone: "Play", cardType: "Character", where: { at: "Self" } } }] } },
            },
            name: "PURE LIQUID GOLD",
        };
        const definition = scenarioCards.definition(prototypeCardName);
        if (definition.type !== "Location") throw new Error("Expected a location");
        expect(scenarioRules().characteristic(source.card, "Lore")).toBe(definition.lore + 1 * 2);
    });
});
