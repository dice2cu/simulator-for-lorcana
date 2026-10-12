import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/whenever-you-play-another-character-you-may-banish-this-char-f5f6111f260d.test.ts
import { describe, expect, it } from "vitest";
import { sameCard } from "../../engine/identity";
// Generated ability ID: f5f6111f260d
const abilityText = "Whenever you play another character, you may banish this character to draw a card.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Magic Broom - Illuminary Keeper",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([false, true])("only draws after accepting and banishing the source (%s)", async (accept) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            prototypeCardName,
            {
                definition: scenarioCards.fixture({
                    fullName: "Played Character",
                    names: ["Played Character"],
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
        const source = playerAt(scenarioGame, 1).play[0];
        const drawn = [...playerAt(scenarioGame, 1).deck].reverse()[0];
        const played = playerAt(scenarioGame, 1).play[1];
        await (async () => {
            if (accept === false) {
                const fixtureSource = played.card;
                const position = playerAt(scenarioGame, 1);
                position.play = position.play.filter((state) => !sameCard(state.card, fixtureSource));
                position.hand.push(fixtureSource);
                position.inkwell.push(
                    ...Array.from({ length: scenarioCards.definition(fixtureSource.fullName).cost }, () => ({
                        card: scenarioCards.create("Dinglehopper"),
                        exerted: false,
                    })),
                );
                const action0: PlayerAction | undefined = { type: "Play", player: 1, card: scenarioCards.instance(2) };
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
            if (accept === true) {
                const fixtureSource = played.card;
                const position = playerAt(scenarioGame, 1);
                position.play = position.play.filter((state) => !sameCard(state.card, fixtureSource));
                position.hand.push(fixtureSource);
                position.inkwell.push(
                    ...Array.from({ length: scenarioCards.definition(fixtureSource.fullName).cost }, () => ({
                        card: scenarioCards.create("Dinglehopper"),
                        exerted: false,
                    })),
                );
                const action0: PlayerAction | undefined = { type: "Play", player: 1, card: scenarioCards.instance(2) };
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
            throw new Error("Unspecified script case");
        })();
        expect(playerAt(scenarioGame, 1).play.map((ink) => ink.card)).toEqual(accept ? [played.card] : [source.card, played.card]);
        expect(playerAt(scenarioGame, 1).discard).toEqual(accept ? [source.card] : []);
        expect(playerAt(scenarioGame, 1).hand).toEqual(accept ? [drawn] : []);
        expect([...playerAt(scenarioGame, 1).deck].reverse()).toEqual(accept ? [] : [drawn]);
    });
});
