import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/when-this-character-challenges-and-is-banished-you-may-banis-53e9f3560cd2.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 53e9f3560cd2
const abilityText = "When this character challenges and is banished, you may banish the challenged character.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Prince Phillip - Dragonslayer",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [
            {
                definition: scenarioCards.fixture({
                    fullName: "Challenge Opponent",
                    names: ["Challenge Opponent"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 10,
                    willpower: 10,
                    lore: 0,
                }),
                exerted: !false,
            },
        ]);
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).play[0];
        const target = playerAt(scenarioGame, 2).play[0];
        source.drying = false;
        expect(scenarioCards.definition(prototypeCardName).abilities?.some((ability) => ability.type === "Triggered")).toBe(true);
        expect(
            await (async () => {
                const action0: PlayerAction | undefined = { type: "Challenge", player: 1, attacker: source.card, defender: target.card };
                if (!action0) throw new Error("Expected a legal action");
                scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                resolvePlayers(scenarioResolution, {
                    1: new ScriptedPlayer().on("Optional", (request) => {
                        return { type: "Decision", answer: { type: "Optional", accept: true } };
                    }),
                });
                scenarioGame = finished(scenarioResolution);
                return true;
            })(),
        ).toBe(true);
        expect(playerAt(scenarioGame, 1).discard).toContainEqual(source.card);
        expect(playerAt(scenarioGame, 2).discard).toContainEqual(target.card);
    });
});
