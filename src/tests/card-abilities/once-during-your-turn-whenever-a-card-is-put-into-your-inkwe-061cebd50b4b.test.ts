import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, inPlay, printedEffect } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
// Converted from reference/card-abilities/once-during-your-turn-whenever-a-card-is-put-into-your-inkwe-061cebd50b4b.test.ts
import { describe, expect, it } from "vitest";
import type { Effect } from "../../model/ability";
// Generated ability ID: 061cebd50b4b
const abilityText = "Once during your turn, whenever a card is put into your inkwell, deal 2 damage to each character in play.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Lyle Tiberius Rourke - Crystallized Mercenary",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            {
                definition: scenarioCards.fixture({
                    fullName: "Lyle Tiberius Rourke - Crystallized Mercenary",
                    names: ["Lyle Tiberius Rourke"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Storyborn", "Villain"],
                    cost: 8,
                    inkwell: true,
                    strength: 6,
                    willpower: 10,
                    lore: 3,
                }),
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Friendly",
                    names: ["Friendly"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 10,
                    lore: 0,
                }),
            },
        ]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [
            {
                definition: scenarioCards.fixture({
                    fullName: "Opposing",
                    names: ["Opposing"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 10,
                    lore: 0,
                }),
            },
        ]);
        const player = playerAt(scenarioGame, 1),
            source = playerAt(scenarioGame, 1).play[0],
            all = [...playerAt(scenarioGame, 1).play, ...playerAt(scenarioGame, 2).play],
            ability: Effect = printedEffect(scenarioCards.definition(source.card.fullName), 0);
        {
            const sourceDefinition = scenarioCards.definition(source.card.fullName);
            scenarioResolution = engine.startEffect(
                scenarioGame,
                ability,
                { card: source.card, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                { card: scenarioCards.lookup },
            );
            resolvePlayers(scenarioResolution, {});
            scenarioGame = finished(scenarioResolution);
        }
        expect(all.map((x) => inPlay(scenarioRules(), x.card).damage)).toEqual([2, 2, 2]);
    });
});
