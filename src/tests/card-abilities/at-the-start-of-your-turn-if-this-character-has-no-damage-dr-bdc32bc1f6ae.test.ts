import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
// Converted from reference/card-abilities/at-the-start-of-your-turn-if-this-character-has-no-damage-dr-bdc32bc1f6ae.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: bdc32bc1f6ae
const abilityText = "At the start of your turn, if this character has no damage, draw a card. Otherwise, he gets +4 ¤ this turn.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Beast - Tragic Hero",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([0, 1])("draws when undamaged, otherwise grants exactly four strength (damage: %s)", async (damage) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioLive: Resolution | undefined, scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).deck = cardIds(
            scenarioCards,
            [
                scenarioCards.fixture({
                    fullName: "Drawn",
                    names: ["Drawn"],
                    type: "Action",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    effect: { type: "Sequence", effects: [] },
                }),
            ].reverse(),
        );
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).play[0];
        inPlay(scenarioRules(), source.card).damage = damage;
        const strength = scenarioRules().characteristic(source.card, "Strength");
        const drawn = [...playerAt(scenarioGame, 1).deck].reverse()[0];
        {
            scenarioLive = engine.startTurn(scenarioGame, { card: scenarioCards.lookup });
            scenarioResolution = scenarioLive;
            resolvePlayers(
                scenarioResolution,
                {},
                {
                    untilAction: true,
                },
            );
            scenarioGame = finished(scenarioResolution, true);
            if (scenarioLive && !scenarioLive.request) scenarioLive = undefined;
        }
        expect(playerAt(scenarioGame, 1).hand).toEqual(damage === 0 ? [drawn] : []);
        expect([...playerAt(scenarioGame, 1).deck].reverse()).toEqual(damage === 0 ? [] : [drawn]);
        expect(scenarioRules().characteristic(source.card, "Strength")).toBe(strength + (damage > 0 ? 4 : 0));
    });
});
