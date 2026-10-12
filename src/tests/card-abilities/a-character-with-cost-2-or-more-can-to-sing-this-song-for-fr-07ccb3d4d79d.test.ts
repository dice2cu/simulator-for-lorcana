import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { getLegalActions, cardInAction } from "../../engine/actions";
// Converted from reference/card-abilities/a-character-with-cost-2-or-more-can-to-sing-this-song-for-fr-07ccb3d4d79d.test.ts
import { describe, expect, it } from "vitest";
import { sameCard } from "../../engine/identity";
// Generated ability ID: 07ccb3d4d79d
const abilityText = "A character with cost 2 or more can ⟳ to sing this song for free.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Another Tale to Spin",
    "Be Our Guest",
    "Della's Moon Lullaby",
    "Ever as Before",
    "Force of a Great Typhoon",
    "Go the Distance",
    "Has Set My Heaaaaaaart...",
    "Heffalumps and Woozles",
    "I Won't Give In",
    "I've Got a Dream",
    "It's Gonna Be Great!",
    "Keep the Ancient Ways",
    "Legend of the Sword in the Stone",
    "Like a Bird in the Sky",
    "Mother Will Protect You",
    "One Jump Ahead",
    "Painting the Roses Red",
    "Poor Unfortunate Souls",
    "Seldom All They Seem",
    "So Much to Give",
    "Strike a Good Match",
    "Sudden Chill",
    "Teeth and Ambitions",
    "The Bare Necessities",
    "This Is My Family",
    "Touch the Sky",
    "Trials and Tribulations",
    "We'll Save Our Village",
    "You Can Fly!",
    "You've Got Some Punch",
    "Zero to Hero",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            {
                definition: scenarioCards.fixture({
                    fullName: "Eligible Singer",
                    names: ["Eligible Singer"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 2,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
                exerted: !true,
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Ineligible Singer",
                    names: ["Ineligible Singer"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 1,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
                exerted: !true,
            },
        ]);
        const player = playerAt(scenarioGame, 1);
        const song = playerAt(scenarioGame, 1).hand[0];
        const [eligible, ineligible] = playerAt(scenarioGame, 1).play;
        const actions = 1 !== scenarioGame.turn.player ? [] : getLegalActions(scenarioGame, { card: scenarioCards.lookup });
        const singActions = actions.filter((action) => action.type === "Sing" && sameCard(cardInAction(action), song));
        expect(singActions.some((action) => "singers" in action && action.singers.some((singingCard) => sameCard(singingCard, eligible.card)))).toBe(true);
        expect(singActions.some((action) => "singers" in action && action.singers.some((singingCard) => sameCard(singingCard, ineligible.card)))).toBe(false);
    });
});
