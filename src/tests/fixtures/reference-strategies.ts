import type { Strategy } from "../../model/strategy";

/**
 * Hand-written plans for some reference decks, read from the human strategy guide.
 * They use the same model and bot as generated strategies. Weights are relative.
 */
export const referenceStrategies: Readonly<Record<string, Strategy>> = {
    // A wide Lady and Tramp board that quests efficiently. Keep the partner a combination needs.
    "Amber-Emerald-Chernadog": {
        priorities: { lore: 1.6, boardControl: 0.9, cards: 0.6, ink: 0.6, development: 1.4 },
        resources: {
            targetInk: 5,
            preserve: [
                { cards: { name: "Tramp" }, importance: 0.7, copies: 1 },
                { cards: { name: "Lady" }, importance: 0.6, copies: 1 },
            ],
        },
        synergies: [
            { enablers: [{ name: "Tramp" }], payoffs: [{ name: "Lady" }], importance: 0.7 },
            { enablers: [{ cardType: "Character", cost: { atMost: 2 } }], payoffs: [{ name: "Tramp" }], importance: 0.4 },
        ],
        caution: 0.3,
    },
    // Fast, high-lore development protected by singing removal with a low-lore character.
    "Amber-Steel-Aggro": {
        priorities: { lore: 1.8, boardControl: 1.0, cards: 0.5, ink: 0.5, development: 1.5 },
        resources: {
            targetInk: 4,
            preserve: [{ cards: { name: "Rhino" }, importance: 0.5, copies: 1 }],
        },
        synergies: [
            { enablers: [{ keyword: "Singer" }], payoffs: [{ song: true }], importance: 0.5 },
            { enablers: [{ cardType: "Character", cost: { atMost: 2 } }], payoffs: [{ name: "Piglet" }], importance: 0.5 },
        ],
        caution: 0.25,
    },
    // Singers turn songs into free removal and refills while the ink develops characters.
    "Amber-Steel-Steelsong": {
        priorities: { lore: 1.1, boardControl: 1.4, cards: 1.0, ink: 0.6, development: 1.1 },
        resources: {
            targetInk: 5,
            preserve: [{ cards: { keyword: "Singer" }, importance: 0.7, copies: 2 }],
        },
        synergies: [{ enablers: [{ keyword: "Singer" }], payoffs: [{ song: true }], importance: 0.9 }],
        caution: 0.4,
    },
};
