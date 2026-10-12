import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, keywords as cardKeywords } from "../player/fixtures";
import { canChallenge } from "../../engine/actions";
// Converted from reference/card-abilities/rush-this-character-can-challenge-the-turn-they-re-played-9a24f92d41a0.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 9a24f92d41a0
const abilityText = "Rush (This character can challenge the turn they're played.)";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Abu - Bold Helmsman",
    "Audrey Ramirez - Gutsy Mechanic",
    "Cruella De Vil - Dodging Traffic",
    "Darkwing Duck - Darkwolf Dog",
    "Dash Parr - Super Speedy",
    "Donald Duck - Vineling Rider",
    "Fox Xanatos - Charismatic Outlaw",
    "Hercules - Clumsy Kid",
    "Hermes - Harried Messenger",
    "Kakamora - Boarding Party",
    "Lena Sabrewing - Rebellious Teenager",
    "Luisa Madrigal - Magically Strong One",
    "March Hare - Absurd Host",
    "Maui - Snow Slider",
    "Mor'du - Wicked with Pride",
    "Mulan - Soldier in Training",
    "Panic - Hammer Enthusiast",
    "Peter Pan - Fearless Fighter",
    "Queen of Hearts - Impulsive Ruler",
    "Rafiki - Mysterious Sage",
    "Snowanna Rainbeau - Cool Competitor",
    "Stitch - Little Rocket",
    "The Phantom Blot - Shadowy Figure",
    "Archimedes - Messenger Owl",
    "Beast - Snowfield Troublemaker",
    "Beast - Wolfsbane",
    "Boo - Energetic Child",
    "Captain Hook - Ruthless Pirate",
    "Copper - On the Scent",
    "Dash Parr - Lava Runner",
    "Duckworth - Ghost Butler",
    "Flotsam - Ursula's Spy",
    "Frozone - Super Cool",
    "Gaston - Pure Paragon",
    "Goofy - Flying Goof",
    "Goofy - Super Goof",
    "Hercules - Daring Demigod",
    "Madam Mim - Fox",
    "Magic Broom - Swift Cleaner",
    "Maui - Hero to All",
    "Monstro - Infamous Whale",
    "Peter Pan - Never Land Hero",
    "Rafiki - Shaman Duelist",
    "Scar - Tempestuous Lion",
    "Scar - Vicious Cheater",
    "Stabbington Brother - Without a Patch",
    "Sven - Keen-Eyed Reindeer",
    "Taran - Magically Armed",
    "Turbo - Royal Hack",
    "Vanellope von Schweetz - Random Roster Racer",
    "Zeus - God of Lightning",
    "Elsa - The Fifth Spirit",
    "Peter Pan - Shadow Finder",
    "Peter Pan's Shadow - Not Sewn On",
    "Sven - Leaping Reindeer",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        const scenarioRules = () => new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [{ definition: "Abu - Bold Helmsman", exerted: !true, drying: true }]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [{ definition: "HeiHei - Boat Snack", exerted: !false }]);
        const attacker = playerAt(scenarioGame, 1).play[0];
        const defender = playerAt(scenarioGame, 2).play[0];
        expect(cardKeywords(scenarioRules(), attacker.card)).toContainEqual("Rush");
        expect(canChallenge(scenarioRules(), attacker.card, defender.card)).toBe(true);
    });
});
