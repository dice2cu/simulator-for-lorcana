import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/return-chosen-character-of-yours-to-your-hand-if-you-returne-93dd3c20a74f.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 93dd3c20a74f
const abilityText = "Return chosen character of yours to your hand. If you returned a Hero character this way, draw 2 cards.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Super Relocation Program",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([false, true])("returns the chosen character and draws only for a Hero: %s", async (hero) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            prototypeCardName,
            {
                definition: scenarioCards.fixture({
                    fullName: "Returned",
                    names: ["Returned"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: hero ? ["Hero"] : ["Ally"],
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
                    fullName: "First",
                    names: ["First"],
                    type: "Action",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    effect: { type: "Sequence", effects: [] },
                }),
                scenarioCards.fixture({
                    fullName: "Second",
                    names: ["Second"],
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
        const [source, target] = playerAt(scenarioGame, 1).play;
        const deck = [...[...playerAt(scenarioGame, 1).deck].reverse()];
        {
            const sourceDefinition = scenarioCards.definition(source.card.fullName);
            scenarioResolution = engine.startEffect(
                scenarioGame,
                {
                    type: "Choose Cards",
                    from: { zone: "Play", player: "You", cardType: "Character" },
                    count: 1,
                    effect: {
                        type: "Sequence",
                        effects: [
                            { type: "Move Card", cards: "Selected Cards", to: "Hand" },
                            {
                                type: "Conditional",
                                if: { exists: { filter: { result: "Moved Cards" }, where: { cardType: "Character", classification: "Hero" } } },
                                then: { type: "Draw", player: "You", amount: 2 },
                            },
                        ],
                    },
                },
                { card: source.card, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                { card: scenarioCards.lookup },
            );
            resolvePlayers(scenarioResolution, {
                1: new ScriptedPlayer().on("Choose Cards", (request) => {
                    expect(request.min).toBe(1);
                    expect(request.max).toBe(1);
                    return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(2)] } };
                }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 1).play.map((ink) => ink.card)).toEqual([source.card]);
        expect(playerAt(scenarioGame, 1).hand).toEqual(hero ? [target.card, ...deck.reverse()] : [target.card]);
        expect([...playerAt(scenarioGame, 1).deck].reverse()).toHaveLength(hero ? 0 : 2);
    });
});
