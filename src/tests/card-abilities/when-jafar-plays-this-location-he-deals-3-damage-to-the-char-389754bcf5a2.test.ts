import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/when-jafar-plays-this-location-he-deals-3-damage-to-the-char-389754bcf5a2.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 389754bcf5a2
const abilityText =
    "When Jafar plays this location, he deals 3 damage to the character with the highest cost each Illumineer has in play. (If there's a tie, the Illumineers choose from the tied characters.)";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Endless Staircase - Perilous Ascent",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            prototypeCardName,
            {
                definition: scenarioCards.fixture({
                    fullName: "Own Character",
                    names: ["Own Character"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 9,
                    inkwell: false,
                    strength: 0,
                    willpower: 8,
                    lore: 0,
                }),
            },
        ]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [
            {
                definition: scenarioCards.fixture({
                    fullName: "Cheap",
                    names: ["Cheap"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 1,
                    inkwell: false,
                    strength: 0,
                    willpower: 8,
                    lore: 0,
                }),
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Expensive",
                    names: ["Expensive"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 6,
                    inkwell: false,
                    strength: 0,
                    willpower: 8,
                    lore: 0,
                }),
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Tied",
                    names: ["Tied"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 6,
                    inkwell: false,
                    strength: 0,
                    willpower: 8,
                    lore: 0,
                }),
            },
        ]);
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).play[0];
        {
            const sourceDefinition = scenarioCards.definition(source.card.fullName);
            scenarioResolution = engine.startEffect(
                scenarioGame,
                {
                    type: "For Each Player",
                    players: "Opponents",
                    effect: {
                        type: "Choose Cards",
                        from: {
                            zone: "Play",
                            player: "Selected Player",
                            cardType: "Character",
                            where: {
                                cost: { equal: { highest: { stat: "Cost", cards: { zone: "Play", player: "Selected Player", cardType: "Character" } } } },
                            },
                        },
                        count: 1,
                        player: "Selected Player",
                        effect: { type: "Deal Damage", cards: "Selected Cards", amount: 3 },
                    },
                },
                { card: source.card, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                { card: scenarioCards.lookup },
            );
            resolvePlayers(scenarioResolution, {
                2: new ScriptedPlayer().on("Choose Cards", (request) => {
                    expect(request.min).toBe(1);
                    expect(request.max).toBe(1);
                    return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(5)] } };
                }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 1).play[1].damage).toBe(0);
        expect(playerAt(scenarioGame, 2).play.map((card) => inPlay(scenarioRules(), card.card).damage ?? 0)).toEqual([0, 0, 3]);
    });
});
