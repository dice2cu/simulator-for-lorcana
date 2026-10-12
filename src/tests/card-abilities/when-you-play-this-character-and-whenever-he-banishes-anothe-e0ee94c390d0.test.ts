import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { getLegalActions } from "../../engine/actions";
import { describe, expect, it } from "vitest";
// Generated ability ID: e0ee94c390d0
const abilityText =
    "When you play this character and whenever he banishes another character in a challenge during your turn, you may choose one: • Draw 2 cards, then choose and discard 2 cards. • Deal 2 damage to chosen character.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Simba - Fighting Prince",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([
        ["Play", 0],
        ["Play", 1],
        ["Challenge", 0],
        ["Challenge", 1],
    ] as const)("offers both modes after the actual %s event (%s)", async (event, mode) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        if (event === "Play") {
            playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [prototypeCardName, "Dinglehopper"]);
        } else {
            playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
            playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, ["Dinglehopper"]);
        }
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [
            {
                fullName: "Target",
                names: ["Target"],
                type: "Character" as const,
                colors: [],
                subtypes: [],
                cost: 0,
                inkwell: false,
                strength: 4,
                willpower: 10,
                lore: 0,
            },
            {
                definition: {
                    ...{
                        fullName: "Target",
                        names: ["Target"],
                        type: "Character" as const,
                        colors: [],
                        subtypes: [],
                        cost: 0,
                        inkwell: false,
                        strength: 4,
                        willpower: 10,
                        lore: 0,
                    },
                    fullName: "Victim",
                    strength: 0,
                    willpower: 1,
                },
                exerted: true,
            },
        ]);
        playerAt(scenarioGame, 1).deck = cardIds(scenarioCards, ["Dinglehopper", "Dinglehopper"]);
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 7 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        const source = event === "Play" ? playerAt(scenarioGame, 1).hand[0] : playerAt(scenarioGame, 1).play[0].card,
            target = playerAt(scenarioGame, 2).play[0].card,
            victim = playerAt(scenarioGame, 2).play[1].card,
            kept = playerAt(scenarioGame, 1).hand[event === "Play" ? 1 : 0],
            drawn = [...playerAt(scenarioGame, 1).deck];
        expect(
            event === "Play"
                ? await (async () => {
                      if (event === "Play" && mode === 1) {
                          const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                              (action) => action.type === "Play" && action.player === 1 && action.card.fullName === prototypeCardName,
                          );
                          if (!action0) throw new Error("Expected a legal action");
                          scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                          resolvePlayers(scenarioResolution, {
                              1: new ScriptedPlayer()
                                  .on("Pay Cost", (request) => {
                                      expect(request.optional).toBe(false);
                                      expect(request.cost).toEqual([{ type: "Ink", amount: 7 }]);
                                      expect(request.ink[0].player).toBe(1);
                                      expect(request.ink[0].cards).toHaveLength(7);
                                      return {
                                          type: "Decision",
                                          answer: {
                                              type: "Pay Cost",
                                              pay: true,
                                              payment: [
                                                  {
                                                      type: "Ink",
                                                      player: 1,
                                                      cards: [
                                                          request.ink[0].cards[0],
                                                          request.ink[0].cards[1],
                                                          request.ink[0].cards[2],
                                                          request.ink[0].cards[3],
                                                          request.ink[0].cards[4],
                                                          request.ink[0].cards[5],
                                                          request.ink[0].cards[6],
                                                      ],
                                                  },
                                              ],
                                          },
                                      };
                                  })
                                  .on("Optional", (request) => {
                                      return { type: "Decision", answer: { type: "Optional", accept: true } };
                                  })
                                  .on("Choose Mode", (request) => {
                                      expect(request.options).toHaveLength(2);
                                      return { type: "Decision", answer: { type: "Choose Mode", mode: 1 } };
                                  })
                                  .on("Choose Cards", (request) => {
                                      expect(request.min).toBe(1);
                                      expect(request.max).toBe(1);
                                      return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(3)] } };
                                  }),
                          });
                          scenarioGame = finished(scenarioResolution);
                          return true;
                      }
                      if (event === "Play" && mode === 0) {
                          const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                              (action) => action.type === "Play" && action.player === 1 && action.card.fullName === prototypeCardName,
                          );
                          if (!action0) throw new Error("Expected a legal action");
                          scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                          resolvePlayers(scenarioResolution, {
                              1: new ScriptedPlayer()
                                  .on("Pay Cost", (request) => {
                                      expect(request.optional).toBe(false);
                                      expect(request.cost).toEqual([{ type: "Ink", amount: 7 }]);
                                      expect(request.ink[0].player).toBe(1);
                                      expect(request.ink[0].cards).toHaveLength(7);
                                      return {
                                          type: "Decision",
                                          answer: {
                                              type: "Pay Cost",
                                              pay: true,
                                              payment: [
                                                  {
                                                      type: "Ink",
                                                      player: 1,
                                                      cards: [
                                                          request.ink[0].cards[0],
                                                          request.ink[0].cards[1],
                                                          request.ink[0].cards[2],
                                                          request.ink[0].cards[3],
                                                          request.ink[0].cards[4],
                                                          request.ink[0].cards[5],
                                                          request.ink[0].cards[6],
                                                      ],
                                                  },
                                              ],
                                          },
                                      };
                                  })
                                  .on("Optional", (request) => {
                                      return { type: "Decision", answer: { type: "Optional", accept: true } };
                                  })
                                  .on("Choose Mode", (request) => {
                                      expect(request.options).toHaveLength(2);
                                      return { type: "Decision", answer: { type: "Choose Mode", mode: 0 } };
                                  })
                                  .on("Choose Cards", (request) => {
                                      expect(request.min).toBe(2);
                                      expect(request.max).toBe(2);
                                      return {
                                          type: "Decision",
                                          answer: { type: "Choose Cards", cards: [scenarioCards.instance(5), scenarioCards.instance(6)] },
                                      };
                                  }),
                          });
                          scenarioGame = finished(scenarioResolution);
                          return true;
                      }
                      throw new Error("Unspecified script case");
                  })()
                : await (async () => {
                      if (event === "Challenge" && mode === 0) {
                          const action0: PlayerAction | undefined = { type: "Challenge", player: 1, attacker: source, defender: victim };
                          if (!action0) throw new Error("Expected a legal action");
                          scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                          resolvePlayers(scenarioResolution, {
                              1: new ScriptedPlayer()
                                  .on("Optional", (request) => {
                                      return { type: "Decision", answer: { type: "Optional", accept: true } };
                                  })
                                  .on("Choose Mode", (request) => {
                                      expect(request.options).toHaveLength(2);
                                      return { type: "Decision", answer: { type: "Choose Mode", mode: 0 } };
                                  })
                                  .on("Choose Cards", (request) => {
                                      expect(request.min).toBe(2);
                                      expect(request.max).toBe(2);
                                      return {
                                          type: "Decision",
                                          answer: { type: "Choose Cards", cards: [scenarioCards.instance(5), scenarioCards.instance(6)] },
                                      };
                                  }),
                          });
                          scenarioGame = finished(scenarioResolution);
                          return true;
                      }
                      if (event === "Challenge" && mode === 1) {
                          const action0: PlayerAction | undefined = { type: "Challenge", player: 1, attacker: source, defender: victim };
                          if (!action0) throw new Error("Expected a legal action");
                          scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                          resolvePlayers(scenarioResolution, {
                              1: new ScriptedPlayer()
                                  .on("Optional", (request) => {
                                      return { type: "Decision", answer: { type: "Optional", accept: true } };
                                  })
                                  .on("Choose Mode", (request) => {
                                      expect(request.options).toHaveLength(2);
                                      return { type: "Decision", answer: { type: "Choose Mode", mode: 1 } };
                                  })
                                  .on("Choose Cards", (request) => {
                                      expect(request.min).toBe(1);
                                      expect(request.max).toBe(1);
                                      return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(3)] } };
                                  }),
                          });
                          scenarioGame = finished(scenarioResolution);
                          return true;
                      }
                      throw new Error("Unspecified script case");
                  })(),
        ).toBe(true);
        expect(playerAt(scenarioGame, 1).hand).toEqual([kept]);
        expect(playerAt(scenarioGame, 1).discard).toEqual(mode === 0 ? drawn : []);
        expect(playerAt(scenarioGame, 1).deck).toHaveLength(mode === 0 ? 0 : 2);
        expect(inPlay(scenarioRules(), target).damage ?? 0).toBe(mode === 1 ? 2 : 0);
    });
});
