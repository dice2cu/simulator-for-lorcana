import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
// Converted from reference/card-abilities/if-you-have-3-or-more-cards-in-your-hand-this-character-can-4159af75f185.test.ts
import { describe, expect, it } from "vitest";
import type { Ability } from "../../model/ability";
// Generated ability ID: 4159af75f185
const abilityText = "If you have 3 or more cards in your hand, this character can't ready.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Broadway - Sturdy and Strong",
    "Bronx - Ferocious Beast",
    "Brooklyn - Full Throttle",
    "Brooklyn - Second in Command",
    "Demona - Betrayer of the Clan",
    "Demona - Scourge of the Wyvern Clan",
    "Elisa Maza - Transformed Gargoyle",
    "Goliath - Clan Leader",
    "Goliath - Guardian of Castle Wyvern",
    "Goliath - Transformed Warrior",
    "Hudson - Determined Reader",
    "Lexington - Fearless Flier",
    "Lexington - Small in Stature",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        const scenarioRules = () => new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [
            scenarioCards.fixture({
                fullName: "Card One",
                names: ["Card One"],
                type: "Action",
                colors: ["Amber"],
                subtypes: [],
                cost: 0,
                inkwell: false,
                effect: { type: "Sequence", effects: [] },
            }),
            scenarioCards.fixture({
                fullName: "Card Two",
                names: ["Card Two"],
                type: "Action",
                colors: ["Amber"],
                subtypes: [],
                cost: 0,
                inkwell: false,
                effect: { type: "Sequence", effects: [] },
            }),
            scenarioCards.fixture({
                fullName: "Card Three",
                names: ["Card Three"],
                type: "Action",
                colors: ["Amber"],
                subtypes: [],
                cost: 0,
                inkwell: false,
                effect: { type: "Sequence", effects: [] },
            }),
        ]);
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).play[0];
        const ability: Ability = {
            type: "Static",
            rule: {
                type: "Conditional",
                if: { value: { count: { zone: "Hand", player: "You" } }, is: { atLeast: 3 } },
                then: { type: "Modify Cards", cards: "Self", modifier: { restriction: "Can't Ready" } },
            },
            name: "STONE BY DAY",
        };
        expect(scenarioRules().restricted(source.card, "Can't Ready")).toBe(true);
    });
});
