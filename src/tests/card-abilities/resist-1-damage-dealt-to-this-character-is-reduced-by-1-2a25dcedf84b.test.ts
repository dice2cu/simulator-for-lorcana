import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
// Converted from reference/card-abilities/resist-1-damage-dealt-to-this-character-is-reduced-by-1-2a25dcedf84b.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 2a25dcedf84b
const abilityText = "Resist +1 (Damage dealt to this character is reduced by 1.)";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Baloo - Freight Pilot",
    "Beast - Thick-Skinned",
    "Eeyore - Overstuffed Donkey",
    "Fat Cat - Felonious Feline",
    "Francine - Eyeing the Evidence",
    "General Li - Head of the Imperial Army",
    "Maudie - Exasperated Nursemaid",
    "Mickey Mouse - Food Fight Defender",
    "Mr. Arrow - Legacy's First Mate",
    "Violet Parr - Force Field Practice",
    "Calhoun - Marine Sergeant",
    "Gizmoduck - Duckburg Defender",
    "Gizmoduck - Suited Up",
    "Hercules - Beloved Hero",
    "Judy Hopps - Snowball Patrol",
    "Kronk - Junior Chipmunk",
    "Kronk - Meat Hut Cook",
    "Magic Broom - Brigade Commander",
    "Piglet - Sturdy Swordsman",
    "Sprout - Experiment 509",
    "The Prince - Never Gives Up",
    "The Troubadour - Musical Narrator",
    "HeiHei - Expanded Consciousness",
    "John Silver - Vengeful Pirate",
    "Lilo & Stitch - Fun-Loving Friends",
    "Mickey Mouse - Playful Sorcerer",
    "Mufasa - Among the Stars",
    "Violet Parr - Super Resilient",
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
        const character = playerAt(scenarioGame, 1).play[0];
        {
            const sourceDefinition = scenarioCards.definition(character.card.fullName);
            scenarioResolution = engine.startEffect(
                scenarioGame,
                { type: "Deal Damage", amount: 3, cards: { cards: [character.card] } },
                { card: character.card, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                { card: scenarioCards.lookup },
            );
            resolvePlayers(scenarioResolution, {});
            scenarioGame = finished(scenarioResolution);
        }
        expect(inPlay(scenarioRules(), character.card).damage ?? 0).toBe(2);
    });
});
