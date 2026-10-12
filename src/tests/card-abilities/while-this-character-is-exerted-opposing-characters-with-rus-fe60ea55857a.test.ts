import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, isExerted } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { getLegalActions } from "../../engine/actions";
// Converted from reference/card-abilities/while-this-character-is-exerted-opposing-characters-with-rus-fe60ea55857a.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: fe60ea55857a
const abilityText = "While this character is exerted, opposing characters with Rush enter play exerted.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Jiminy Cricket - Level-Headed and Wise",
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
                    fullName: "Jiminy Cricket - Level-Headed and Wise",
                    names: ["Jiminy Cricket"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Storyborn", "Mentor"],
                    cost: 2,
                    inkwell: true,
                    strength: 1,
                    willpower: 1,
                    lore: 1,
                }),
                exerted: !false,
            },
        ]);
        playerAt(scenarioGame, 2).hand = cardIds(scenarioCards, [
            scenarioCards.fixture({
                fullName: "Rusher",
                names: ["Rusher"],
                type: "Character",
                colors: ["Amber"],
                subtypes: [],
                abilities: [{ type: "Keyword", keyword: { name: "Rush" } }],
                cost: 0,
                inkwell: false,
                strength: 0,
                willpower: 1,
                lore: 0,
            }),
        ]);
        const opponent = playerAt(scenarioGame, 2),
            rusher = playerAt(scenarioGame, 2).hand[0];
        scenarioGame.turn = { number: scenarioGame.turn.number, player: 2 };
        playerAt(scenarioGame, 2).inkwell = Array.from({ length: 5 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        {
            const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                (action) => action.type === "Play" && action.player === 2 && action.card.fullName === rusher.fullName,
            );
            if (!action0) throw new Error("Expected a legal action");
            scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
            resolvePlayers(scenarioResolution, {});
            scenarioGame = finished(scenarioResolution);
        }
        expect(!isExerted(scenarioRules(), rusher)).toBe(false);
    });
});
