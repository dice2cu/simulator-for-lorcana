import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/chosen-character-gets-1-this-turn-if-you-have-a-character-na-757e84228a2a.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 757e84228a2a
const abilityText = "Chosen character gets -1 ¤ this turn. If you have a character named Darkwing Duck in play, chosen character gets -2 ¤ this turn instead.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Darkwing's Gas Device",
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
                    fullName: "Aladdin",
                    names: ["Aladdin"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Pirate", "Villain"],
                    cost: 0,
                    inkwell: false,
                    strength: 5,
                    willpower: 5,
                    lore: 2,
                }),
                damage: 2,
            },
        ]);
        const player = playerAt(scenarioGame, 1);
        playerAt(scenarioGame, 1).play.push({
            card: scenarioCards.create(
                scenarioCards.fixture({
                    fullName: "Darkwing Duck",
                    names: ["Darkwing Duck"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
            ),
        });
        const [source, target] = playerAt(scenarioGame, 1).play;
        const printed = scenarioCards.definition(prototypeCardName).abilities?.find((ability) => ability.type === "Activated");
        if (!printed || printed.type !== "Activated") throw new Error("Missing printed ability");
        const ability = printed.effect;
        {
            const sourceDefinition = scenarioCards.definition(source.card.fullName);
            scenarioResolution = engine.startEffect(
                scenarioGame,
                ability,
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
        expect(scenarioRules().characteristic(target.card, "Strength")).toBe(3);
    });
});
