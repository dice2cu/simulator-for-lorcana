import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/whenever-this-character-quests-you-may-return-chosen-seven-d-59dc0f8b65f8.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 59dc0f8b65f8
const abilityText = "Whenever this character quests, you may return chosen Seven Dwarfs character of yours to your hand to draw a card.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Snow White - Merry as the Morning",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([false, true])("returns a friendly Seven Dwarfs character before drawing when accepted (%s)", async (accept) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            prototypeCardName,
            {
                definition: scenarioCards.fixture({
                    fullName: "Dwarf",
                    names: ["Dwarf"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Seven Dwarfs"],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Not A Dwarf",
                    names: ["Not A Dwarf"],
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
        const [source, dwarf, other] = playerAt(scenarioGame, 1).play;
        const drawn = [...playerAt(scenarioGame, 1).deck].reverse()[0];
        await (async () => {
            if (accept === true) {
                const action0: PlayerAction | undefined = { type: "Quest", player: 1, card: source.card };
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
            }
            if (accept === false) {
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
        })();
        expect(playerAt(scenarioGame, 1).play.map((ink) => ink.card)).toEqual(accept ? [source.card, other.card] : [source.card, dwarf.card, other.card]);
        expect(playerAt(scenarioGame, 1).hand).toEqual(accept ? [dwarf.card, drawn] : []);
        expect([...playerAt(scenarioGame, 1).deck].reverse()).toEqual(accept ? [] : [drawn]);
    });
});
