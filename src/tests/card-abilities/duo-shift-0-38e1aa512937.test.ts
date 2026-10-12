import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { getLegalActions } from "../../engine/actions";
// Converted from reference/card-abilities/duo-shift-0-38e1aa512937.test.ts
import { describe, expect, it } from "vitest";
import { sameCard } from "../../engine/identity";
// Generated ability ID: 38e1aa512937
const abilityText = "Duo Shift 0 ⬡";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Mickey Mouse & Minnie Mouse - Adventuring Duo",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            {
                definition: scenarioCards.fixture({
                    fullName: "Mickey Mouse",
                    names: ["Mickey Mouse"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
            },
        ]);
        const mickey = playerAt(scenarioGame, 1).play[0];
        const printed = scenarioCards.definition(mickey.card.fullName);
        if (printed.type !== "Character") throw new Error("Expected a character");
        const minnie = (() => {
            const card = scenarioCards.create({ ...printed, fullName: "Minnie Mouse", names: ["Minnie Mouse"] });
            playerAt(scenarioGame, 1).play.push({ card, damage: 0, exerted: false, drying: false });
            return card;
        })();
        const player = playerAt(scenarioGame, 1);
        const shifter = playerAt(scenarioGame, 1).hand[0];
        const base = playerAt(scenarioGame, 1).play[0];
        const action = (scenarioGame.turn.player !== scenarioGame.turn.player ? [] : getLegalActions(scenarioGame, { card: scenarioCards.lookup })).find(
            (action) => action.type === "Shift" && sameCard(action.card, shifter) && action.onto.length === 2,
        );
        if (!action) throw new Error("Expected a duo shift");
        const result = await (async () => {
            const action0: PlayerAction | undefined = action;
            if (!action0) throw new Error("Expected a legal action");
            scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
            resolvePlayers(scenarioResolution, {});
            scenarioGame = finished(scenarioResolution);
            return true;
        })();
        expect(result).toBe(true);
        expect(playerAt(scenarioGame, 1).play.map((entry) => entry.card)).toContainEqual(shifter);
        expect((inPlay(scenarioRules(), shifter).under ?? []).map((state) => state.card)).toEqual([mickey.card, minnie]);
    });
});
