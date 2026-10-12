import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, inPlay, keywords as cardKeywords } from "../player/fixtures";
// Converted from reference/card-abilities/this-character-gains-resist-1-for-each-other-knight-characte-5c532587d27e.test.ts
import { describe, expect, it } from "vitest";
import type { Ability } from "../../model/ability";
// Generated ability ID: 5c532587d27e
const abilityText =
    "This character gains Resist +1 for each other Knight character you have in play. (Damage dealt to this character is reduced by 1 for each other Knight.)";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Snow White - Fair-Hearted",
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
        inPlay(scenarioRules(), source.card).under = [other.card, other.card].map((card) => ({ card, faceDown: true }));
        other.location = source.card;
        const ability: Ability = {
            type: "Static",
            rule: {
                type: "Modify Cards",
                cards: "Self",
                modifier: {
                    gainKeyword: "Resist",
                    amount: {
                        multiply: [1, { count: { zone: "Play", player: "You", cardType: "Character", where: { classification: "Knight" }, exclude: "Self" } }],
                    },
                },
            },
            name: "NATURAL LEADER",
        };
        expect(cardKeywords(scenarioRules(), source.card).map((x) => x.toLowerCase())).toContainEqual("resist");
    });
});
