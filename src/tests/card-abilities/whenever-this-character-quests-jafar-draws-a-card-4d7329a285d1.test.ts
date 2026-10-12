import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
// Converted from reference/card-abilities/whenever-this-character-quests-jafar-draws-a-card-4d7329a285d1.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 4d7329a285d1
const abilityText = "Whenever this character quests, Jafar draws a card.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Jasmine - Ephemeral Princess",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("draws exactly one for the campaign controller when this character quests, not another character", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            prototypeCardName,
            {
                definition: scenarioCards.fixture({
                    fullName: "Other",
                    names: ["Other"],
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
        const [source, other] = playerAt(scenarioGame, 1).play;
        const drawn = [...playerAt(scenarioGame, 1).deck].reverse()[0];
        {
            const action0: PlayerAction | undefined = { type: "Quest", player: 1, card: other.card };
            if (!action0) throw new Error("Expected a legal action");
            scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
            resolvePlayers(scenarioResolution, {});
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 1).hand).toEqual([]);
        {
            const action0: PlayerAction | undefined = { type: "Quest", player: 1, card: source.card };
            if (!action0) throw new Error("Expected a legal action");
            scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
            resolvePlayers(scenarioResolution, {});
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 1).hand).toEqual([drawn]);
        expect([...playerAt(scenarioGame, 1).deck].reverse()).toEqual([]);
        expect(playerAt(scenarioGame, 2).hand).toEqual([]);
    });
});
