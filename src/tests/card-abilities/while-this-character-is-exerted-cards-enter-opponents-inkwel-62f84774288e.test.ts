import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, isExerted } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
// Converted from reference/card-abilities/while-this-character-is-exerted-cards-enter-opponents-inkwel-62f84774288e.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 62f84774288e
const abilityText = "While this character is exerted, cards enter opponents' inkwells exerted.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Daisy Duck - Paranormal Investigator",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).play[0].exerted = !false;
        playerAt(scenarioGame, 2).hand = cardIds(scenarioCards, [
            scenarioCards.fixture({
                fullName: "Inkable",
                names: ["Inkable"],
                type: "Character",
                colors: ["Amber"],
                subtypes: [],
                cost: 0,
                inkwell: true,
                strength: 0,
                willpower: 1,
                lore: 0,
            }),
        ]);
        const card = playerAt(scenarioGame, 2).hand[0];
        scenarioGame.turn = { number: scenarioGame.turn.number, player: 2 };
        {
            const action0: PlayerAction | undefined = { type: "Ink", player: 2, card: card };
            if (!action0) throw new Error("Expected a legal action");
            scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
            resolvePlayers(scenarioResolution, {});
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 2).inkwell.map((entry) => entry.card)).toContainEqual(card);
        expect(!isExerted(scenarioRules(), card)).toBe(false);
    });
});
