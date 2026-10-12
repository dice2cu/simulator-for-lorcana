import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, inPlay, isExerted } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { getLegalActions } from "../../engine/actions";
import { describe, expect, it } from "vitest";
import { cards } from "../../cards";
import type { Card } from "../../model/card";
/** Regressions found by reading parsed abilities against their printed text. */
const printing = (fullName: string, text: string): Card => {
    const found = cards.find((card) => card.fullName === fullName && card.fullText?.includes(text));
    if (!found) throw new Error(`Missing printing of ${fullName}`);
    return found;
};
describe("readying a group, then restricting it", () => {
    const princess = "Snow White - Lost in the Forest";
    it("Moana restricts only Princesses she readied, and nothing when declined", async () => {
        for (const text of ["ready your other Princess characters", "ready your other exerted Princess characters"]) {
            for (const accept of [true, false]) {
                const scenarioCards = testCards();
                let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
                let scenarioResolution: Resolution | undefined;
                const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
                const moana = scenarioCards.fixture({ ...printing("Moana - Of Motunui", text), fullName: "Moana Printing" });
                playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [moana, { definition: scenarioCards.definition(princess), exerted: true }]);
                const [source, other] = playerAt(scenarioGame, 1).play;
                expect(
                    await (async () => {
                        if (accept === true && text === "ready your other Princess characters") {
                            const action0: PlayerAction | undefined = { type: "Quest", player: 1, card: source.card };
                            if (!action0) throw new Error("Expected a legal action");
                            scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                            resolvePlayers(scenarioResolution, {
                                1: new ScriptedPlayer().on("Optional", (request) => {
                                    return { type: "Decision", answer: { type: "Optional", accept: true } };
                                }),
                            });
                            scenarioGame = finished(scenarioResolution);
                            return true;
                        }
                        if (accept === false && text === "ready your other Princess characters") {
                            const action0: PlayerAction | undefined = { type: "Quest", player: 1, card: source.card };
                            if (!action0) throw new Error("Expected a legal action");
                            scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                            resolvePlayers(scenarioResolution, {
                                1: new ScriptedPlayer().on("Optional", (request) => {
                                    return { type: "Decision", answer: { type: "Optional", accept: false } };
                                }),
                            });
                            scenarioGame = finished(scenarioResolution);
                            return true;
                        }
                        if (accept === true && text === "ready your other exerted Princess characters") {
                            const action0: PlayerAction | undefined = { type: "Quest", player: 1, card: source.card };
                            if (!action0) throw new Error("Expected a legal action");
                            scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                            resolvePlayers(scenarioResolution, {
                                1: new ScriptedPlayer().on("Optional", (request) => {
                                    return { type: "Decision", answer: { type: "Optional", accept: true } };
                                }),
                            });
                            scenarioGame = finished(scenarioResolution);
                            return true;
                        }
                        if (accept === false && text === "ready your other exerted Princess characters") {
                            const action0: PlayerAction | undefined = { type: "Quest", player: 1, card: source.card };
                            if (!action0) throw new Error("Expected a legal action");
                            scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                            resolvePlayers(scenarioResolution, {
                                1: new ScriptedPlayer().on("Optional", (request) => {
                                    return { type: "Decision", answer: { type: "Optional", accept: false } };
                                }),
                            });
                            scenarioGame = finished(scenarioResolution);
                            return true;
                        }
                        throw new Error("Unspecified script case");
                    })(),
                ).toBe(true);
                expect(isExerted(scenarioRules(), other.card)).toBe(!accept);
                expect(scenarioRules().restricted(other.card, "Can't Quest")).toBe(accept);
            }
        }
    });
    it("Mr. Litwak can still quest and challenge after declining to ready", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, ["Mr. Litwak - Arcade Owner"]);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, ["Mickey Mouse - True Friend"]);
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 3 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        const litwak = playerAt(scenarioGame, 1).play[0].card;
        {
            const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                (action) => action.type === "Play" && action.player === 1 && action.card.fullName === "Mickey Mouse - True Friend",
            );
            if (!action0) throw new Error("Expected a legal action");
            scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
            resolvePlayers(scenarioResolution, {
                1: new ScriptedPlayer()
                    .on("Pay Cost", (request) => {
                        expect(request.optional).toBe(false);
                        expect(request.cost).toEqual([{ type: "Ink", amount: 3 }]);
                        expect(request.ink[0].player).toBe(1);
                        expect(request.ink[0].cards).toHaveLength(3);
                        return {
                            type: "Decision",
                            answer: {
                                type: "Pay Cost",
                                pay: true,
                                payment: [{ type: "Ink", player: 1, cards: [request.ink[0].cards[0], request.ink[0].cards[1], request.ink[0].cards[2]] }],
                            },
                        };
                    })
                    .on("Optional", (request) => {
                        return { type: "Decision", answer: { type: "Optional", accept: false } };
                    }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        expect(scenarioRules().restricted(litwak, "Can't Quest")).toBe(false);
        expect(scenarioRules().restricted(litwak, "Can't Challenge")).toBe(false);
    });
});
describe("challenge triggers", () => {
    it("Thebes gains lore when a character here banishes another in a challenge", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, ["Thebes - The Big Olive", "Hercules - Divine Hero"]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [{ definition: scenarioCards.definition("Mickey Mouse - True Friend"), exerted: true }]);
        const [thebes, hercules] = playerAt(scenarioGame, 1).play;
        inPlay(scenarioRules(), hercules.card).location = thebes.card;
        const defender = playerAt(scenarioGame, 2).play[0].card;
        expect(
            await (async () => {
                const action0: PlayerAction | undefined = { type: "Challenge", player: 1, attacker: hercules.card, defender };
                if (!action0) throw new Error("Expected a legal action");
                scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                resolvePlayers(scenarioResolution, {});
                scenarioGame = finished(scenarioResolution);
                return true;
            })(),
        ).toBe(true);
        expect(playerAt(scenarioGame, 2).play).toEqual([]);
        expect(playerAt(scenarioGame, 1).lore).toBe(2);
    });
    it("Mad Hatter draws when a damaged opposing character challenges him", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        scenarioGame.turn = { number: scenarioGame.turn.number, player: 2 };
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [{ definition: scenarioCards.definition("Mad Hatter - Unruly Eccentric"), exerted: true }]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [{ definition: scenarioCards.definition("Hercules - Divine Hero"), damage: 1 }]);
        playerAt(scenarioGame, 1).deck = cardIds(scenarioCards, ["Mickey Mouse - True Friend"]);
        const hatter = playerAt(scenarioGame, 1).play[0].card,
            attacker = playerAt(scenarioGame, 2).play[0].card;
        expect(
            await (async () => {
                const action0: PlayerAction | undefined = { type: "Challenge", player: 2, attacker, defender: hatter };
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
        expect(playerAt(scenarioGame, 1).hand).toHaveLength(1);
    });
    it("Namaari cannot deal the copied damage to the character she challenged", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, ["Namaari - Heir of Fang"]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [
            { definition: scenarioCards.definition("Mickey Mouse - True Friend"), exerted: true },
            "Mickey Mouse - True Friend",
        ]);
        const namaari = playerAt(scenarioGame, 1).play[0].card,
            victim = playerAt(scenarioGame, 2).play[0].card;
        await expect(
            (async () => {
                const action0: PlayerAction | undefined = { type: "Challenge", player: 1, attacker: namaari, defender: victim };
                if (!action0) throw new Error("Expected a legal action");
                scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                resolvePlayers(scenarioResolution, {
                    1: new ScriptedPlayer()
                        .on("Optional", (request) => {
                            return { type: "Decision", answer: { type: "Optional", accept: true } };
                        })
                        .on("Choose Cards", (request) => {
                            expect(request.min).toBe(1);
                            expect(request.max).toBe(1);
                            return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(2)] } };
                        }),
                });
                scenarioGame = finished(scenarioResolution);
                return true;
            })(),
        ).rejects.toThrow();
    });
});
describe("batches and declined plays", () => {
    it("Mamá Coco gains 1 lore once when several cards are milled together", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, ["Mamá Coco - Visiting the Park"]);
        playerAt(scenarioGame, 1).deck = cardIds(scenarioCards, ["Mickey Mouse - True Friend", "Mickey Mouse - True Friend", "Mickey Mouse - True Friend"]);
        const coco = playerAt(scenarioGame, 1).play[0].card;
        const printed = scenarioCards.definition("Mamá Coco - Visiting the Park");
        if (printed.type !== "Character") throw new Error("Expected a character");
        {
            const sourceDefinition = scenarioCards.definition(coco.fullName);
            scenarioResolution = engine.startEffect(
                scenarioGame,
                { type: "Move Card", cards: { zone: "Deck", player: "You", position: "Top", take: 3 }, to: "Discard" },
                { card: coco, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                { card: scenarioCards.lookup },
            );
            resolvePlayers(scenarioResolution, {});
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 1).discard).toHaveLength(3);
        expect(scenarioRules().characteristic(coco, "Lore")).toBe(printed.lore + 1);
    });
    it("Dash Parr discards a revealed card he chooses not to play", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, ["Dash Parr - Super Fast"]);
        playerAt(scenarioGame, 1).deck = cardIds(scenarioCards, ["Mickey Mouse - True Friend"]);
        const dash = playerAt(scenarioGame, 1).play[0].card,
            top = playerAt(scenarioGame, 1).deck[0];
        expect(
            await (async () => {
                const action0: PlayerAction | undefined = { type: "Quest", player: 1, card: dash };
                if (!action0) throw new Error("Expected a legal action");
                scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                resolvePlayers(scenarioResolution, {
                    1: new ScriptedPlayer()
                        .on("Optional", (request) => {
                            return { type: "Decision", answer: { type: "Optional", accept: true } };
                        })
                        .on("Optional", (request) => {
                            return { type: "Decision", answer: { type: "Optional", accept: false } };
                        }),
                });
                scenarioGame = finished(scenarioResolution);
                return true;
            })(),
        ).toBe(true);
        expect(playerAt(scenarioGame, 1).discard).toEqual([top]);
    });
});
describe("whenever you remove damage", () => {
    it("Grand Pabbie ignores damage an opponent removes", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            "Grand Pabbie - Oldest and Wisest",
            { definition: scenarioCards.definition("Mickey Mouse - True Friend"), damage: 2 },
        ]);
        const [pabbie, hurt] = playerAt(scenarioGame, 1).play;
        const heal = { type: "Remove Damage" as const, cards: { cards: [hurt.card] }, amount: 1 };
        {
            const sourceDefinition = scenarioCards.definition(pabbie.card.fullName);
            scenarioResolution = engine.startEffect(
                scenarioGame,
                heal,
                { card: pabbie.card, player: 2, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                { card: scenarioCards.lookup },
            );
            resolvePlayers(scenarioResolution, {});
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 1).lore).toBe(0);
        {
            const sourceDefinition = scenarioCards.definition(pabbie.card.fullName);
            scenarioResolution = engine.startEffect(
                scenarioGame,
                heal,
                { card: pabbie.card, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                { card: scenarioCards.lookup },
            );
            resolvePlayers(scenarioResolution, {});
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 1).lore).toBe(2);
    });
});
