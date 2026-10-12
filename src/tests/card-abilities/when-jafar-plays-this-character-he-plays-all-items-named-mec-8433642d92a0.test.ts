import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/when-jafar-plays-this-character-he-plays-all-items-named-mec-8433642d92a0.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 8433642d92a0
const abilityText = "When Jafar plays this character, he plays all items named Mechanical Snake from his discard for free.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Jafar - Spectral Sorcerer",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).discard = cardIds(scenarioCards, [
            "Mechanical Snake",
            "Mechanical Snake",
            scenarioCards.fixture({
                fullName: "Unrelated Item",
                names: ["Unrelated Item"],
                type: "Item",
                colors: ["Amber"],
                subtypes: [],
                cost: 0,
                inkwell: false,
            }),
        ]);
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 0 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).play[0];
        const [first, second, unrelated] = playerAt(scenarioGame, 1).discard;
        {
            const sourceDefinition = scenarioCards.definition(source.card.fullName);
            scenarioResolution = engine.startEffect(
                scenarioGame,
                { type: "Play", cards: { zone: "Discard", player: "You", cardType: "Item", where: { name: "Mechanical Snake" } }, free: true },
                { card: source.card, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                { card: scenarioCards.lookup },
            );
            resolvePlayers(scenarioResolution, {
                1: new ScriptedPlayer().on("Choose Trigger", (request) => {
                    const expected = {
                        player: 1,
                        source: { card: scenarioCards.instance(2), player: 1, kind: "Ability" },
                        effect: { type: "Gain Control", cards: { zone: "Play", cardType: "Item", where: { name: "The Reforged Crown" } } },
                    };
                    const options = request.options.filter(({ option, ...description }) => JSON.stringify(description) === JSON.stringify(expected));
                    expect(options).toHaveLength(1);
                    return { type: "Decision", answer: { type: "Choose Trigger", option: options[0].option } };
                }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 1).play.map((ink) => ink.card)).toEqual(expect.arrayContaining([first, second]));
        expect(playerAt(scenarioGame, 1).discard).toEqual([unrelated]);
    });
});
