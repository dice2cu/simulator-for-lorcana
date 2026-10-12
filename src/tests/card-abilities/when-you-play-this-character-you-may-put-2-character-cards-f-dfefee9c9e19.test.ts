import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, printedEffect, keywords as cardKeywords } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/when-you-play-this-character-you-may-put-2-character-cards-f-dfefee9c9e19.test.ts
import { describe, expect, it } from "vitest";
import type { Effect } from "../../model/ability";
// Generated ability ID: dfefee9c9e19
const abilityText =
    "When you play this character, you may put 2 character cards from your discard on the bottom of your deck to give this character Rush this turn. (They can challenge the turn they're played.)";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Roller Bob - Sid's Toy",
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
        playerAt(scenarioGame, 1).discard = cardIds(scenarioCards, [
            scenarioCards.fixture({
                fullName: "One",
                names: ["One"],
                type: "Character",
                colors: ["Amber"],
                subtypes: [],
                cost: 0,
                inkwell: false,
                strength: 0,
                willpower: 1,
                lore: 0,
            }),
            scenarioCards.fixture({
                fullName: "Two",
                names: ["Two"],
                type: "Character",
                colors: ["Amber"],
                subtypes: [],
                cost: 0,
                inkwell: false,
                strength: 0,
                willpower: 1,
                lore: 0,
            }),
        ]);
        const player = playerAt(scenarioGame, 1),
            source = playerAt(scenarioGame, 1).play[0],
            cards = [...playerAt(scenarioGame, 1).discard],
            ability: Effect = printedEffect(scenarioCards.definition(source.card.fullName), 0);
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
                    .on("Optional", (request) => {
                        return { type: "Decision", answer: { type: "Optional", accept: true } };
                    })
                    .on("Choose Cards", (request) => {
                        expect(request.min).toBe(2);
                        expect(request.max).toBe(2);
                        return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(2), scenarioCards.instance(3)] } };
                    }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        expect([...playerAt(scenarioGame, 1).deck].reverse()).toEqual(expect.arrayContaining(cards));
        expect(cardKeywords(scenarioRules(), source.card).map((x) => x.toLowerCase())).toContainEqual("rush");
    });
});
