import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { describe, expect, it } from "vitest";
// Generated ability ID: 7e97869173dd
const abilityText = "Once per turn, when this character moves to a location, gain lore equal to that location's ◊.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Peter Pan - Lost Boy Leader",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("gains the destination lore from an actual move", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            prototypeCardName,
            {
                fullName: "Destination",
                names: ["Destination"],
                type: "Location",
                colors: ["Amber"],
                subtypes: [],
                cost: 0,
                inkwell: false,
                willpower: 8,
                lore: 3,
                moveCost: 0,
            },
        ]);
        const [source, destination] = playerAt(scenarioGame, 1).play.map((state) => state.card);
        expect(
            await (async () => {
                const action0: PlayerAction | undefined = { type: "Move", player: 1, card: source, location: destination };
                if (!action0) throw new Error("Expected a legal action");
                scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                resolvePlayers(scenarioResolution, {});
                scenarioGame = finished(scenarioResolution);
                return true;
            })(),
        ).toBe(true);
        expect(playerAt(scenarioGame, 1).lore).toBe(3);
    });
});
