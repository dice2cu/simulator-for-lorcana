import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { describe, expect, it } from "vitest";
// Generated ability ID: 4a2819e11540
const abilityText = "If an effect would cause you to discard one or more cards, you don't discard.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Kronk - Laid Back",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([true, false])("prevents effect discards only while in play (%s)", async (inPlay) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, inPlay ? [prototypeCardName] : []);
        playerAt(scenarioGame, 1).discard = cardIds(scenarioCards, inPlay ? [] : [prototypeCardName]);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, ["Dinglehopper"]);
        const source = inPlay ? playerAt(scenarioGame, 1).play[0].card : playerAt(scenarioGame, 1).discard[0];
        const protectedCard = playerAt(scenarioGame, 1).hand[0];
        {
            const sourceDefinition = scenarioCards.definition(source.fullName);
            scenarioResolution = engine.startEffect(
                scenarioGame,
                { type: "Discard", cards: { cards: [protectedCard] } },
                { card: source, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                { card: scenarioCards.lookup },
            );
            resolvePlayers(scenarioResolution, {});
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 1).hand).toEqual(inPlay ? [protectedCard] : []);
        expect(playerAt(scenarioGame, 1).discard).toEqual(inPlay ? [] : [source, protectedCard]);
    });
});
