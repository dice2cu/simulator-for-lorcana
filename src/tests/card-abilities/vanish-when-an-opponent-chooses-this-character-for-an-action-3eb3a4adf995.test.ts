import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { getLegalActions } from "../../engine/actions";
// Converted from reference/card-abilities/vanish-when-an-opponent-chooses-this-character-for-an-action-3eb3a4adf995.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 3eb3a4adf995
const abilityText = "Vanish (When an opponent chooses this character for an action, banish them.)";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Palace Guard - Spectral Sentry",
    "Rajah - Ghostly Tiger",
    "Abu - Illusory Pachyderm",
    "Giant Cobra - Ghostly Serpent",
    "Iago - Giant Spectral Parrot",
    "Magic Carpet - Phantom Rug",
    "The Sultan - Royal Apparition",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            {
                definition: scenarioCards.fixture({
                    fullName: "Palace Guard - Spectral Sentry",
                    names: ["Palace Guard"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Dreamborn", "Ally", "Illusion"],
                    cost: 1,
                    inkwell: true,
                    strength: 1,
                    willpower: 4,
                    lore: 1,
                }),
                exerted: !false,
            },
        ]);
        playerAt(scenarioGame, 2).hand = cardIds(scenarioCards, ["Dragon Fire"]);
        playerAt(scenarioGame, 2).inkwell = Array.from({ length: 5 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        scenarioGame.turn = { number: scenarioGame.turn.number, player: 2 };
        const character = playerAt(scenarioGame, 1).play[0];
        {
            const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                (action) => action.type === "Play" && action.player === 2 && action.card.fullName === "Dragon Fire",
            );
            if (!action0) throw new Error("Expected a legal action");
            scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
            resolvePlayers(scenarioResolution, {
                2: new ScriptedPlayer()
                    .on("Pay Cost", (request) => {
                        expect(request.optional).toBe(false);
                        expect(request.cost).toEqual([{ type: "Ink", amount: 5 }]);
                        expect(request.ink[0].player).toBe(2);
                        expect(request.ink[0].cards).toHaveLength(5);
                        return {
                            type: "Decision",
                            answer: {
                                type: "Pay Cost",
                                pay: true,
                                payment: [
                                    {
                                        type: "Ink",
                                        player: 2,
                                        cards: [
                                            request.ink[0].cards[0],
                                            request.ink[0].cards[1],
                                            request.ink[0].cards[2],
                                            request.ink[0].cards[3],
                                            request.ink[0].cards[4],
                                        ],
                                    },
                                ],
                            },
                        };
                    })
                    .on("Choose Cards", (request) => {
                        expect(request.min).toBe(1);
                        expect(request.max).toBe(1);
                        return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(1)] } };
                    }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 1).play.map((entry) => entry.card)).not.toContainEqual(character.card);
        expect(playerAt(scenarioGame, 1).discard).toContainEqual(character.card);
    });
});
