import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
// Converted from reference/card-abilities/whenever-this-character-quests-while-at-a-location-draw-card-975a71a838ac.test.ts
import { describe, expect, it } from "vitest";
import type { Effect } from "../../model/ability";
// Generated ability ID: 975a71a838ac
const abilityText = "Whenever this character quests while at a location, draw cards equal to that location's ◊.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Carl Fredricksen - On the Move",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            prototypeCardName,
            {
                definition: scenarioCards.fixture({
                    fullName: "Location",
                    names: ["Location"],
                    type: "Location",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    willpower: 1,
                    lore: 3,
                    moveCost: 0,
                }),
            },
        ]);
        playerAt(scenarioGame, 1).deck = cardIds(
            scenarioCards,
            Array.from({ length: 3 }, (_, i) =>
                scenarioCards.fixture({
                    fullName: "Draw " + i,
                    names: ["Draw " + i],
                    type: "Action",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    effect: { type: "Sequence", effects: [] },
                }),
            ).reverse(),
        );
        const player = playerAt(scenarioGame, 1),
            source = playerAt(scenarioGame, 1).play[0],
            location = playerAt(scenarioGame, 1).play[1],
            ability: Effect = { type: "Draw", player: "You", amount: { stat: "Lore", card: "Self" } };
        source.location = location.card;
        {
            const action0: PlayerAction | undefined = { type: "Quest", player: 1, card: source.card };
            if (!action0) throw new Error("Expected a legal action");
            scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
            resolvePlayers(scenarioResolution, {});
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 1).hand).toHaveLength(3);
    });
});
