import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, inPlay, printedEffect } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/once-during-your-turn-you-may-move-chosen-character-from-her-27c09e765f33.test.ts
import { describe, expect, it } from "vitest";
import type { Effect } from "../../model/ability";
// Generated ability ID: 27c09e765f33
const abilityText = "Once during your turn, you may move chosen character from here to another location for free. If you do, gain 1 lore.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Carl's House - Flying High",
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
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).play[0];
        const ability: Effect = printedEffect(scenarioCards.definition(source.card.fullName), 0);
        const traveler = (() => {
            const card = scenarioCards.create(scenarioCards.definition("Mickey Mouse - True Friend"));
            playerAt(scenarioGame, 1).play.push({ card, damage: 0, exerted: false, drying: false });
            return card;
        })();
        inPlay(scenarioRules(), traveler).location = source.card;
        const destination = (() => {
            const card = scenarioCards.create(scenarioCards.definition("Motunui - Island Paradise"));
            playerAt(scenarioGame, 1).play.push({ card, damage: 0, exerted: false, drying: false });
            return card;
        })();
        {
            const sourceDefinition = scenarioCards.definition(source.card.fullName);
            scenarioResolution = engine.startEffect(
                scenarioGame,
                ability,
                { card: source.card, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                { card: scenarioCards.lookup },
            );
            resolvePlayers(scenarioResolution, {
                1: new ScriptedPlayer()
                    .on("Choose Cards", (request) => {
                        expect(request.min).toBe(1);
                        expect(request.max).toBe(1);
                        return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(2)] } };
                    })
                    .on("Choose Cards", (request) => {
                        expect(request.min).toBe(1);
                        expect(request.max).toBe(1);
                        return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(3)] } };
                    }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 1).lore).toBe(1);
    });
    it("moves only a character from here, and only to another location of its player", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        const house = playerAt(scenarioGame, 1).play[0].card;
        const ability: Effect = printedEffect(scenarioCards.definition(house.fullName), 0);
        const resident = (() => {
            const card = scenarioCards.create(scenarioCards.definition("Mickey Mouse - True Friend"));
            playerAt(scenarioGame, 1).play.push({ card, damage: 0, exerted: false, drying: false });
            return card;
        })();
        inPlay(scenarioRules(), resident).location = house;
        const elsewhere = (() => {
            const card = scenarioCards.create(scenarioCards.definition("Mickey Mouse - True Friend"));
            playerAt(scenarioGame, 1).play.push({ card, damage: 0, exerted: false, drying: false });
            return card;
        })();
        const opposing = (() => {
            const card = scenarioCards.create(scenarioCards.definition("Mickey Mouse - True Friend"));
            playerAt(scenarioGame, 2).play.push({ card, damage: 0, exerted: false, drying: false });
            return card;
        })();
        const theirs = (() => {
            const card = scenarioCards.create(scenarioCards.definition("Motunui - Island Paradise"));
            playerAt(scenarioGame, 2).play.push({ card, damage: 0, exerted: false, drying: false });
            return card;
        })();
        for (const outsider of [elsewhere, opposing]) {
            await expect(
                (async () => {
                    if ([elsewhere, opposing].indexOf(outsider) === 0) {
                        const sourceDefinition = scenarioCards.definition(house.fullName);
                        scenarioResolution = engine.startEffect(
                            scenarioGame,
                            ability,
                            { card: house, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                            { card: scenarioCards.lookup },
                        );
                        resolvePlayers(scenarioResolution, {
                            1: new ScriptedPlayer().on("Choose Cards", (request) => {
                                expect(request.min).toBe(1);
                                expect(request.max).toBe(1);
                                return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(3)] } };
                            }),
                        });
                        scenarioGame = finished(scenarioResolution);
                        return true;
                    }
                    if ([elsewhere, opposing].indexOf(outsider) === 1) {
                        const sourceDefinition = scenarioCards.definition(house.fullName);
                        scenarioResolution = engine.startEffect(
                            scenarioGame,
                            ability,
                            { card: house, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                            { card: scenarioCards.lookup },
                        );
                        resolvePlayers(scenarioResolution, {
                            1: new ScriptedPlayer().on("Choose Cards", (request) => {
                                expect(request.min).toBe(1);
                                expect(request.max).toBe(1);
                                return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(4)] } };
                            }),
                        });
                        scenarioGame = finished(scenarioResolution);
                        return true;
                    }
                    throw new Error("Unspecified script case");
                })(),
            ).rejects.toThrow();
        }
        {
            const sourceDefinition = scenarioCards.definition(house.fullName);
            scenarioResolution = engine.startEffect(
                scenarioGame,
                ability,
                { card: house, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                { card: scenarioCards.lookup },
            );
            resolvePlayers(scenarioResolution, {
                1: new ScriptedPlayer()
                    .on("Choose Cards", (request) => {
                        expect(request.min).toBe(1);
                        expect(request.max).toBe(1);
                        return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(2)] } };
                    })
                    .on("Choose Cards", (request) => {
                        expect(request.min).toBe(1);
                        expect(request.max).toBe(1);
                        return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(5)] } };
                    }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        expect(inPlay(scenarioRules(), resident).location).toEqual(house);
        expect(playerAt(scenarioGame, 1).lore).toBe(0);
    });
});
