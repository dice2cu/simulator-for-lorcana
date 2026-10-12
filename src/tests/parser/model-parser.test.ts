import { describe, expect, it } from "vitest";
import { cards } from "../fixtures/catalog";
import type { CatalogCard } from "../../parser/index";
import { parseCard, parseCatalog } from "../../parser/index";
import type { CardRules } from "../../model/ability";
import { validateCardRules } from "../../model/validate";

const catalog = { cards };

it("binds each Whirlpool character's next-turn restriction separately rather than creating a live board-wide rule", () => {
    const result = parseCard({
        fullName: "Whirlpool",
        type: "Action",
        effects: ["Exert all opposing characters. They can't ready at the start of the their next turn."],
    });
    if (!result.supported) throw new Error(JSON.stringify(result.issues));
    expect(result.rules).toMatchObject({
        effect: {
            type: "Sequence",
            effects: [
                { type: "Exert" },
                {
                    type: "For Each Card",
                    cards: { zone: "Play", player: "Opponents", cardType: "Character" },
                    effect: { type: "Modify Cards", modifier: { restriction: "Can't Ready At Start Of Turn" }, duration: { until: "End Of Next Turn" } },
                },
            ],
        },
    });
});

it("reads the location lore rather than the character lore for I've Got a Dream", () => {
    const result = parseCard({
        fullName: "I've Got a Dream",
        type: "Action",
        effects: ["Ready chosen character of yours at a location. They can't quest for the rest of this turn. Gain lore equal to that location's ◊."],
    });
    if (!result.supported) throw new Error(JSON.stringify(result.issues));
    expect(result.rules).toMatchObject({
        effect: {
            type: "Choose Cards",
            effect: {
                type: "Sequence",
                effects: [{ type: "Ready" }, { type: "Modify Cards" }, { type: "Gain Lore", amount: { stat: "Lore", card: { locationOf: "Selected Cards" } } }],
            },
        },
    });
});

function card(name: string): CatalogCard {
    const found = catalog.cards.find((entry) => entry.fullName === name);
    if (!found) throw new Error(`Missing catalog fixture: ${name}`);
    return found;
}

function rules(name: string): CardRules {
    const result = parseCard(card(name));
    expect(result.supported).toBe(true);
    if (!result.supported) throw new Error(JSON.stringify(result.issues));
    return result.rules;
}

/** Parses one printed ability on an otherwise blank character. */
function synthetic(type: "static" | "triggered", effect: string) {
    const result = parseCard({ fullName: "Synthetic", type: "Character", abilities: [{ type, effect, fullText: effect }] });
    if (!result.supported) throw new Error(JSON.stringify(result.issues));
    return result.rules.abilities?.[0];
}

describe("catalog text to the new ability model", () => {
    it("keeps the played location separate from a later chosen moving friend", () => {
        const ability = synthetic(
            "triggered",
            "Whenever you play a location, you may move this character and up to 1 of your other characters to that location for free.",
        );
        expect(ability).toMatchObject({
            type: "Triggered",
            effect: {
                type: "Optional",
                effect: {
                    type: "Choose Cards",
                    effect: {
                        type: "Move To Location",
                        location: { event: "Card" },
                        free: true,
                    },
                },
            },
        });
    });
    it("plays the matching characters formerly under a banished card, not the source itself", () => {
        const ability = synthetic(
            "triggered",
            "When this character is banished, if any of the cards that were under them are character cards, you may play those characters from your discard for free.",
        );
        expect(ability).toMatchObject({
            type: "Triggered",
            effect: {
                type: "Optional",
                effect: {
                    type: "Play",
                    free: true,
                    cards: {
                        filter: {
                            filter: { atEvent: "Before", cards: { zone: "Under", under: "Self" } },
                            where: { cardType: "Character" },
                        },
                        where: { zone: "Discard", player: "You" },
                    },
                },
            },
        });
    });
    it("chooses one recipient for damage moved from multiple characters", () => {
        const result = parseCard({
            fullName: "Everybody's Got a Weakness",
            type: "Action",
            effects: [
                "Move 1 damage counter from each damaged character you have in play to chosen opposing character. Draw a card for each damage counter moved this way.",
            ],
        });
        if (!result.supported) throw new Error(JSON.stringify(result.issues));
        expect(result.rules).toMatchObject({
            effect: {
                type: "Choose Cards",
                effect: {
                    type: "For Each Card",
                    effect: {
                        type: "Sequence",
                        effects: [
                            { type: "Move Damage", from: "Selected Cards", to: "Parent Selected Cards", amount: 1 },
                            { type: "Draw", amount: { result: "Damage Moved" } },
                        ],
                    },
                },
            },
        });
    });
    it("keeps the exerted character separate from the later discarded card", () => {
        const result = parseCard({
            fullName: "Freeze",
            type: "Action",
            effects: [
                "Exert chosen character. Then, you may choose and discard a card. If you do, the exerted character can't ready at the start of their next turn.",
            ],
        });
        expect(result.supported).toBe(true);
        if (!result.supported) throw new Error(JSON.stringify(result.issues));
        expect(result.rules).toMatchObject({
            effect: {
                type: "Choose Cards",
                effect: {
                    type: "Sequence",
                    effects: [
                        { type: "Exert" },
                        {
                            type: "Optional",
                            effect: {
                                type: "Do Then",
                                do: { type: "Choose Cards" },
                                then: {
                                    type: "Modify Cards",
                                    cards: "Selected Cards",
                                    duration: { until: "End Of Next Turn", player: { ownerOf: "Selected Cards" } },
                                },
                            },
                        },
                    ],
                },
            },
        });
    });
    it("moves all damage without offering a smaller amount", () => {
        const result = parseCard({
            fullName: "Can't Hold it Back Anymore",
            type: "Action",
            effects: ["Exert chosen opposing character. Move all damage counters from all other characters to that character."],
        });
        expect(result.supported).toBe(true);
        if (!result.supported) throw new Error(JSON.stringify(result.issues));
        expect(result.rules).toMatchObject({
            effect: {
                type: "Choose Cards",
                effect: {
                    type: "Sequence",
                    effects: [
                        { type: "Exert" },
                        {
                            type: "For Each Card",
                            effect: {
                                type: "Move Damage",
                                from: "Selected Cards",
                                to: "Parent Selected Cards",
                                amount: { stat: "Damage", card: "Selected Cards" },
                            },
                        },
                    ],
                },
            },
        });
    });
    it("keeps conditional turn-long strength changes as an action effect", () => {
        const result = parseCard({
            fullName: "Olympus Would Be That Way",
            type: "Action",
            effects: ["Your characters get +3 ¤ while challenging a location this turn."],
        });
        expect(result.supported).toBe(true);
        if (!result.supported) throw new Error(JSON.stringify(result.issues));
        expect(result.rules).toMatchObject({
            type: "Action",
            effect: {
                type: "Modify Cards",
                modifier: {
                    stat: "Strength",
                    amount: 3,
                    when: {
                        and: [
                            { inChallenge: "Affected Card", role: "Attacker" },
                            { exists: { filter: { challengeParticipant: "Defender" }, where: { cardType: "Location" } } },
                        ],
                    },
                },
                duration: { until: "End Of Turn" },
            },
        });
        expect(result.rules.abilities).toBeUndefined();
    });
    it("keeps the placement of looked-at cards inside the optional look", () => {
        expect(
            synthetic(
                "triggered",
                "Whenever this character quests, you may look at the top card of your deck. Put it on either the top or the bottom of your deck.",
            ),
        ).toMatchObject({
            effect: { type: "Optional", effect: { type: "Sequence", effects: [{ type: "Look" }, { type: "Choose Mode" }] } },
        });
    });
    it("requires positive incoming damage for a character that takes damage", () => {
        expect(synthetic("triggered", "Whenever this character takes damage, gain 1 lore.")).toMatchObject({
            trigger: {
                anyOf: [
                    { event: "Deal Damage", card: "Self", when: { value: { event: "Amount" }, is: { greaterThan: 0 } } },
                    { event: "Put Damage", card: "Self", when: { value: { event: "Amount" }, is: { greaterThan: 0 } } },
                ],
            },
        });
    });
    it("damage dealt does not include counters put or moved onto a character", () => {
        expect(synthetic("triggered", "Whenever this character is dealt damage, gain 1 lore.")).toMatchObject({
            trigger: {
                event: "Deal Damage",
                card: "Self",
                when: { value: { event: "Amount" }, is: { greaterThan: 0 } },
            },
        });
    });
    it("keeps Morgana's chosen recipient separate from each damage donor", () => {
        expect(
            synthetic("triggered", "When you play this character, you may choose an opposing character and move 1 damage from each other character to them."),
        ).toMatchObject({
            effect: {
                type: "Optional",
                effect: {
                    type: "Choose Cards",
                    effect: {
                        type: "For Each Card",
                        effect: {
                            type: "Move Damage",
                            from: "Selected Cards",
                            to: "Parent Selected Cards",
                            amount: 1,
                        },
                    },
                },
            },
        });
    });
    it("keeps Belle's additional ink permission and ten-ink lore condition separate", () => {
        expect(rules("Belle - Strange but Special")).toMatchObject({
            abilities: [
                {
                    type: "Static",
                    rule: {
                        type: "Conditional",
                        if: { duringTurnOf: "You" },
                        then: {
                            type: "Modify Players",
                            players: "You",
                            modifier: { additionalInk: 1 },
                        },
                    },
                },
                {
                    type: "Static",
                    rule: {
                        type: "Conditional",
                        if: { value: { count: { zone: "Inkwell", player: "You" } }, is: { atLeast: 10 } },
                        then: { type: "Modify Cards", cards: "Self", modifier: { stat: "Lore", amount: 4 } },
                    },
                },
            ],
        });
    });

    it("does not strip Sail the Azurite Sea's duration as though it were an ability title", () => {
        expect(rules("Sail the Azurite Sea")).toEqual({
            type: "Action",
            effect: {
                type: "Sequence",
                effects: [
                    {
                        type: "Create Rule",
                        rule: { type: "Modify Players", players: "You", modifier: { additionalInk: 1 } },
                        duration: { until: "End Of Turn" },
                    },
                    { type: "Draw", player: "You", amount: 1 },
                ],
            },
        } satisfies CardRules);
    });

    it("retains the item owner inside Glean's single target choice", () => {
        expect(rules("Glean")).toEqual({
            type: "Action",
            effect: {
                type: "Choose Cards",
                from: { zone: "Play", cardType: "Item" },
                count: 1,
                effect: {
                    type: "Sequence",
                    effects: [
                        { type: "Banish", cards: "Selected Cards" },
                        { type: "Gain Lore", player: { ownerOf: "Selected Cards" }, amount: 2 },
                    ],
                },
            },
        } satisfies CardRules);
    });

    it("uses one chosen character for Break Free's damage and both changes", () => {
        expect(rules("Break Free")).toEqual({
            type: "Action",
            effect: {
                type: "Choose Cards",
                from: { zone: "Play", cardType: "Character", player: "You" },
                count: 1,
                effect: {
                    type: "Sequence",
                    effects: [
                        { type: "Deal Damage", cards: "Selected Cards", amount: 1 },
                        { type: "Modify Cards", cards: "Selected Cards", modifier: { gainKeyword: "Rush" }, duration: { until: "End Of Turn" } },
                        { type: "Modify Cards", cards: "Selected Cards", modifier: { stat: "Strength", amount: 1 }, duration: { until: "End Of Turn" } },
                    ],
                },
            },
        } satisfies CardRules);
    });

    it("reads Motunui occupancy before the banished character leaves play", () => {
        expect(rules("Motunui - Island Paradise")).toMatchObject({
            abilities: [
                {
                    type: "Triggered",
                    trigger: { event: "Banish", card: { atEvent: "Before", cards: { zone: "Play", cardType: "Character", where: { at: "Self" } } } },
                    effect: { type: "Optional", effect: { type: "Move Card", cards: { event: "Card" }, to: "Inkwell", exerted: true } },
                },
            ],
        });
    });

    it("makes Thebes check where the banisher was, not where the victim was", () => {
        expect(rules("Thebes - The Big Olive")).toMatchObject({
            abilities: [
                {
                    type: "Triggered",
                    trigger: {
                        event: "Banish",
                        kind: "Challenge",
                        source: {
                            atEvent: "Before",
                            cards: {
                                zone: "Play",
                                cardType: "Character",
                                where: { at: "Self" },
                            },
                        },
                        when: { duringTurnOf: "You" },
                    },
                },
            ],
        });
    });

    it("protects characters at Tiana's Palace as a live rule, not the location itself", () => {
        expect(rules("Tiana's Palace - Jazz Restaurant")).toMatchObject({
            abilities: [
                {
                    type: "Static",
                    rule: {
                        type: "Modify Cards",
                        cards: { zone: "Play", cardType: "Character", where: { at: "Self" } },
                        modifier: { restriction: "Can't Be Challenged" },
                    },
                },
            ],
        });
    });

    it("lets each player independently accept or decline Donald's draw", () => {
        expect(rules("Donald Duck - Perfect Gentleman")).toMatchObject({
            abilities: [
                { type: "Keyword" },
                {
                    type: "Triggered",
                    effect: {
                        type: "For Each Player",
                        players: "All",
                        effect: { type: "Optional", player: "Selected Player", effect: { type: "Draw", player: "Selected Player", amount: 1 } },
                    },
                },
            ],
        });
    });

    it("lets each opponent choose their own ready character for Swooping Strike", () => {
        expect(rules("Swooping Strike")).toEqual({
            type: "Action",
            effect: {
                type: "For Each Player",
                players: "Opponents",
                effect: {
                    type: "Choose Cards",
                    from: { zone: "Play", cardType: "Character", player: "Selected Player", where: { exerted: false } },
                    player: "Selected Player",
                    count: 1,
                    effect: { type: "Exert", cards: "Selected Cards" },
                },
            },
        } satisfies CardRules);
    });

    it("preserves both Boost target types on Duckworth's banishment trigger", () => {
        expect(rules("Duckworth - Ghost Butler")).toMatchObject({
            abilities: [
                { type: "Keyword" },
                {
                    type: "Triggered",
                    effect: {
                        type: "Optional",
                        effect: {
                            type: "Choose Cards",
                            count: 1,
                            from: { zone: "Play", player: "You", where: { or: [{ cardType: "Character" }, { cardType: "Location" }], keyword: "Boost" } },
                            effect: {
                                type: "Move Card",
                                cards: { zone: "Deck", player: "You", position: "Top", take: 1 },
                                to: "Under",
                                under: "Selected Cards",
                                faceDown: true,
                            },
                        },
                    },
                },
            ],
        });
    });

    it("puts Scrooge's top card under the card just played, without another choice", () => {
        expect(rules("Scrooge McDuck - Cavern Prospector")).toMatchObject({
            abilities: [
                { type: "Keyword" },
                {
                    type: "Triggered",
                    trigger: {
                        event: "Play",
                        player: "You",
                        card: { zone: "Any", where: { or: [{ cardType: "Character" }, { cardType: "Location" }], keyword: "Boost" } },
                    },
                    effect: {
                        type: "Optional",
                        effect: {
                            type: "Move Card",
                            cards: { zone: "Deck", player: "You", position: "Top", take: 1 },
                            to: "Under",
                            under: { event: "Card" },
                            faceDown: true,
                        },
                    },
                },
            ],
        });
    });

    it("restricts Jolly Roger's free movement to Pirates entering this exact location", () => {
        expect(rules("Jolly Roger - Hook's Ship")).toMatchObject({
            abilities: [
                { type: "Static" },
                {
                    type: "Static",
                    rule: {
                        type: "Alternate Cost",
                        for: "Move",
                        cards: { zone: "Play", player: "You", cardType: "Character", where: { classification: "Pirate" } },
                        location: "Self",
                        cost: [],
                    },
                },
            ],
        });
    });

    it("represents Potato Shift as shifting onto an item, not a made-up classification", () => {
        expect(rules("Posey - Vampire Potato")).toEqual({
            type: "Character",
            abilities: [
                {
                    type: "Keyword",
                    keyword: {
                        name: "Shift",
                        cost: [{ type: "Ink", amount: 5 }],
                        onto: { zone: "Play", player: "You", cardType: "Item", where: { name: "Potato" } },
                    },
                },
            ],
        } satisfies CardRules);
    });

    it("requires the two printed names for Duo Shift and permits one or both for Combo Shift", () => {
        const duo = card("Mickey Mouse & Minnie Mouse - Adventuring Duo");
        const combo = card("Sulley & Boo - Scare Buddies");
        for (const [original, names, count, cost] of [
            [duo, ["Mickey Mouse", "Minnie Mouse"], 2, 0],
            [combo, ["Boo", "Sulley"], "One Or Two", 4],
        ] as const) {
            const ability = original.abilities?.[0];
            if (!ability) throw new Error("Missing Shift ability");
            expect(parseCard({ ...original, abilities: [ability] })).toMatchObject({
                supported: true,
                rules: {
                    abilities: [
                        {
                            type: "Keyword",
                            keyword: {
                                name: "Shift",
                                count,
                                cost: [{ type: "Ink", amount: cost }],
                                ...(count === 2
                                    ? { names }
                                    : {
                                          onto: {
                                              zone: "Play",
                                              player: "You",
                                              cardType: "Character",
                                              where: {
                                                  or: names.map((name) => ({ name })),
                                              },
                                          },
                                          when: { differentNames: "Selected Cards" },
                                      }),
                            },
                        },
                    ],
                },
            });
        }
    });

    it("delays Temporary Shift cleanup and returns only the top physical card", () => {
        const original = card("Sun Yee - Red Panda Spirit");
        const ability = original.abilities?.[0];
        if (!ability) throw new Error("Missing Temporary Shift ability");
        expect(parseCard({ ...original, abilities: [ability] })).toMatchObject({
            supported: true,
            rules: {
                abilities: [
                    {
                        type: "Keyword",
                        keyword: {
                            name: "Shift",
                            cost: [{ type: "Ink", amount: 2 }],
                            onto: { zone: "Play", player: "You", cardType: "Character", where: { classification: "Red Panda" } },
                            afterShift: {
                                type: "Create Trigger",
                                trigger: { event: "Turn End", player: "You", when: { exists: { filter: "Self", where: { zone: "Play" } } } },
                                duration: { until: "End Of Turn" },
                                uses: 1,
                                effect: {
                                    type: "Sequence",
                                    effects: [
                                        { type: "Remove Damage", cards: { filter: "Self", where: { zone: "Play" } }, amount: "All" },
                                        { type: "Move Card", cards: { filter: "Self", where: { zone: "Play" } }, to: "Hand", wholeStack: false },
                                    ],
                                },
                            },
                        },
                    },
                ],
            },
        });
    });

    it("can check an empty opposing hand without needing a card in that hand", () => {
        expect(rules("Belle - Bookworm")).toMatchObject({
            abilities: [
                {
                    type: "Static",
                    rule: {
                        type: "Conditional",
                        if: {
                            existsPlayer: {
                                from: "Opponents",
                                where: {
                                    value: { count: { zone: "Hand", player: "Selected Player" } },
                                    is: { equal: 0 },
                                },
                            },
                        },
                        then: { type: "Modify Cards", cards: "Self", modifier: { stat: "Lore", amount: 2 } },
                    },
                },
            ],
        });
    });

    it("compares each opposing hand separately instead of summing all opposing hands", () => {
        expect(rules("Clarabelle - Contented Wallflower")).toMatchObject({
            abilities: [
                {
                    type: "Triggered",
                    trigger: {
                        event: "Play",
                        card: "Self",
                        when: {
                            existsPlayer: {
                                from: "Opponents",
                                where: {
                                    value: { count: { zone: "Hand", player: "Selected Player" } },
                                    is: { greaterThan: { count: { zone: "Hand", player: "You" } } },
                                },
                            },
                        },
                    },
                },
            ],
        });
    });

    it("limits Ursula's freeze to the target owner's next ready step", () => {
        expect(rules("Ursula - Sea Witch")).toMatchObject({
            abilities: [
                {
                    type: "Triggered",
                    effect: {
                        type: "Choose Cards",
                        from: { zone: "Play", cardType: "Character", player: "Opponents" },
                        count: 1,
                        effect: {
                            type: "Modify Cards",
                            cards: "Selected Cards",
                            modifier: { restriction: "Can't Ready At Start Of Turn" },
                            duration: { until: "End Of Next Turn", player: { ownerOf: "Selected Cards" } },
                        },
                    },
                },
            ],
        });
    });

    it("delays Frying Pan's challenge restriction until the affected player's next turn", () => {
        expect(rules("Frying Pan")).toMatchObject({
            abilities: [
                {
                    type: "Activated",
                    effect: {
                        type: "Choose Cards",
                        effect: {
                            type: "Modify Cards",
                            cards: "Selected Cards",
                            modifier: { restriction: "Can't Challenge" },
                            duration: { duringNextTurn: { ownerOf: "Selected Cards" } },
                        },
                    },
                },
            ],
        });
    });

    it("lets Taran choose a player before selecting cards from that player's discard", () => {
        expect(rules("Taran - Magically Armed")).toMatchObject({
            abilities: [
                { type: "Keyword" },
                {
                    type: "Triggered",
                    effect: {
                        type: "Choose Player",
                        from: "All",
                        effect: {
                            type: "Choose Cards",
                            from: { zone: "Discard", player: "Selected Player" },
                            count: { upTo: 2 },
                            effect: {
                                type: "Move Card",
                                cards: "Selected Cards",
                                to: "Deck",
                                position: "Bottom",
                                order: "Chosen",
                            },
                        },
                    },
                },
            ],
        });
    });

    it("keeps Enchantress's bonus conditional on being the defender", () => {
        expect(rules("Enchantress - Unexpected Judge")).toMatchObject({
            abilities: [
                {
                    type: "Static",
                    rule: {
                        type: "Conditional",
                        if: { inChallenge: "Self", role: "Defender" },
                        then: {
                            type: "Modify Cards",
                            cards: "Self",
                            modifier: { stat: "Strength", amount: 2 },
                        },
                    },
                },
            ],
        });
    });

    it("matches the opposing damaged character, not Beast, as the trigger card", () => {
        expect(rules("Beast - Relentless")).toMatchObject({
            abilities: [
                {
                    type: "Triggered",
                    trigger: {
                        anyOf: [
                            { event: "Deal Damage", card: { zone: "Any", player: "Opponents", cardType: "Character" } },
                            { event: "Put Damage", card: { zone: "Any", player: "Opponents", cardType: "Character" } },
                        ],
                    },
                    effect: { type: "Optional", effect: { type: "Ready", cards: "Self" } },
                },
            ],
        });
    });

    it("applies a challenge source classification to the banisher, not the victim", () => {
        expect(rules("Nick Wilde - Persistent Investigator")).toMatchObject({
            abilities: [
                { type: "Keyword" },
                {
                    type: "Triggered",
                    trigger: {
                        event: "Banish",
                        kind: "Challenge",
                        source: { zone: "Any", player: "You", cardType: "Character", where: { classification: "Detective" } },
                        when: { duringTurnOf: "You" },
                    },
                    effect: { type: "Draw", player: "You", amount: 1 },
                },
            ],
        });
    });

    it("counts exerted characters as a state, not as a printed classification", () => {
        const original = card("Elinor - Renowned Diplomat");
        const ability = original.abilities?.[0];
        if (!ability) throw new Error("Missing Elinor ability");
        expect(parseCard({ ...original, abilities: [ability] })).toMatchObject({
            supported: true,
            rules: {
                abilities: [
                    {
                        type: "Triggered",
                        trigger: {
                            when: { value: { count: { zone: "Play", player: "You", cardType: "Character", where: { exerted: true } } }, is: { atLeast: 3 } },
                        },
                    },
                ],
            },
        });
    });

    it("keeps deck inspection mandatory when taking a card is optional", () => {
        expect(rules("Be Our Guest")).toEqual({
            type: "Action",
            playRules: [{ type: "Sing", cost: 2 }],
            effect: {
                type: "Sequence",
                effects: [
                    { type: "Look", cards: { zone: "Deck", player: "You", position: "Top", take: 4 } },
                    {
                        type: "Choose Cards",
                        from: { filter: { result: "Looked At Cards" }, where: { cardType: "Character" } },
                        count: { upTo: 1 },
                        effect: {
                            type: "Sequence",
                            effects: [
                                { type: "Reveal", cards: "Selected Cards" },
                                { type: "Move Card", cards: "Selected Cards", to: "Hand" },
                                {
                                    type: "Move Card",
                                    cards: { difference: [{ result: "Looked At Cards" }, "Selected Cards"] },
                                    to: "Deck",
                                    position: "Bottom",
                                    order: "Chosen",
                                },
                            ],
                        },
                    },
                ],
            },
        });
    });

    it("makes Aurora exert an item, not herself, to inspect the deck", () => {
        expect(rules("Aurora - Lore Guardian")).toMatchObject({
            abilities: [
                { type: "Keyword" },
                {
                    type: "Static",
                    rule: {
                        type: "Modify Cards",
                        cards: { zone: "Play", cardType: "Item", player: "You" },
                        modifier: { restriction: "Can't Be Chosen", byPlayer: "Opponents" },
                    },
                },
                {
                    type: "Activated",
                    cost: [
                        {
                            type: "Choose Cards",
                            from: { zone: "Play", player: "You", cardType: "Item" },
                            count: 1,
                            cost: [{ type: "Exert", cards: "Selected Cards" }],
                        },
                    ],
                    effect: {
                        type: "Sequence",
                        effects: [
                            { type: "Look", cards: { zone: "Deck", player: "You", position: "Top", take: 1 } },
                            {
                                type: "Choose Mode",
                                options: [
                                    { type: "Move Card", cards: { result: "Looked At Cards" }, to: "Deck", position: "Top" },
                                    { type: "Move Card", cards: { result: "Looked At Cards" }, to: "Deck", position: "Bottom" },
                                ],
                            },
                        ],
                    },
                },
            ],
        });
    });

    it("keeps a multi-card banishment cost separate from the damage target", () => {
        expect(rules("Beast - Frustrated Designer")).toMatchObject({
            abilities: [
                {
                    type: "Activated",
                    cost: [
                        { type: "Exert", cards: "Self" },
                        { type: "Ink", amount: 2 },
                        {
                            type: "Choose Cards",
                            from: { zone: "Play", player: "You", cardType: "Item" },
                            count: 2,
                            cost: [{ type: "Banish", cards: "Selected Cards" }],
                        },
                    ],
                    effect: {
                        type: "Choose Cards",
                        from: { zone: "Play", cardType: "Character" },
                        count: 1,
                        effect: { type: "Deal Damage", cards: "Selected Cards", amount: 5 },
                    },
                },
            ],
        });
    });

    it("uses the chosen character's lore for Lucky Dime", () => {
        expect(rules("Lucky Dime")).toMatchObject({
            abilities: [
                {
                    type: "Activated",
                    effect: {
                        type: "Choose Cards",
                        from: { zone: "Play", cardType: "Character", player: "You" },
                        count: 1,
                        effect: { type: "Gain Lore", player: "You", amount: { stat: "Lore", card: "Selected Cards" } },
                    },
                },
            ],
        });
    });

    it("keeps a ramp trigger optional and puts the top card into ink exerted", () => {
        expect(rules("Mickey Mouse - Detective")).toEqual({
            type: "Character",
            abilities: [
                {
                    type: "Triggered",
                    name: "GET A CLUE",
                    trigger: { event: "Play", card: "Self" },
                    effect: {
                        type: "Optional",
                        effect: { type: "Move Card", cards: { zone: "Deck", player: "You", position: "Top", take: 1 }, to: "Inkwell", exerted: true },
                    },
                },
            ],
        });
    });

    it("tests a location occupancy condition against characters at that exact location", () => {
        expect(rules("Institute of Technology - Prestigious University")).toMatchObject({
            abilities: [
                {
                    type: "Static",
                    rule: {
                        type: "Modify Cards",
                        cards: { zone: "Play", cardType: "Character", where: { classification: "Inventor", at: "Self" } },
                        modifier: { stat: "Willpower", amount: 1 },
                    },
                },
                {
                    type: "Triggered",
                    trigger: {
                        event: "Turn Start",
                        player: "You",
                        when: {
                            value: { count: { zone: "Play", cardType: "Character", player: "You", where: { at: "Self" } } },
                            is: { atLeast: 1 },
                        },
                    },
                    effect: { type: "Gain Lore", player: "You", amount: 1 },
                },
            ],
        });
    });

    it("keeps Beast's damage check and both branches", () => {
        expect(rules("Beast - Tragic Hero")).toMatchObject({
            abilities: [
                { type: "Keyword" },
                {
                    type: "Triggered",
                    effect: {
                        type: "Conditional",
                        if: { every: "Self", where: { damage: { equal: 0 } } },
                        then: { type: "Draw", player: "You", amount: 1 },
                        otherwise: { type: "Modify Cards", cards: "Self", modifier: { stat: "Strength", amount: 4 }, duration: { until: "End Of Turn" } },
                    },
                },
            ],
        });
    });

    it("counts other matching characters without including the ability source", () => {
        expect(rules("Winnie the Pooh - Hunny Archmage")).toMatchObject({
            abilities: [
                {
                    type: "Static",
                    rule: {
                        type: "Conditional",
                        if: {
                            value: { count: { zone: "Play", player: "You", exclude: "Self", cardType: "Character", where: { classification: "Hunny" } } },
                            is: { atLeast: 2 },
                        },
                        then: { type: "Modify Cards", cards: "Self", modifier: { stat: "Lore", amount: 2 } },
                    },
                },
            ],
        });
    });

    it("chooses one destination for the whole group moved by Voyage", () => {
        expect(rules("Voyage")).toEqual({
            type: "Action",
            effect: {
                type: "Choose Cards",
                count: { upTo: 2 },
                from: { zone: "Play", cardType: "Character", player: "You" },
                effect: {
                    type: "Choose Cards",
                    count: 1,
                    from: { zone: "Play", cardType: "Location" },
                    effect: { type: "Move To Location", cards: "Parent Selected Cards", location: "Selected Cards", free: true },
                },
            },
        });
    });

    it("produces deterministic output without generated IDs", () => {
        expect(parseCard(card("Merlin - Goat"))).toEqual(parseCard(card("Merlin - Goat")));
        expect(JSON.stringify(rules("Merlin - Goat"))).not.toContain("ability-");
    });
    it("parses action instructions and the song play rule separately", () => {
        expect(rules("Friends on the Other Side")).toEqual({
            type: "Action",
            effect: { type: "Draw", player: "You", amount: 2 },
            playRules: [{ type: "Sing", cost: 3 }],
        });
    });

    it("prevents only discards caused by effects", () => {
        expect(synthetic("static", "If an effect would cause you to discard one or more cards, you don't discard.")).toEqual({
            type: "Replacement",
            replacement: { event: { event: "Discard", player: "You", kind: "Effect" } },
        });
    });

    it("lets opposing players decide and pay together", () => {
        expect(
            synthetic("triggered", "When you play this character, the opposing players together choose an item or location of theirs and banish it."),
        ).toMatchObject({ effect: { type: "Choose Cards", player: { together: "Opponents" }, from: { zone: "Play", player: "Opponents" } } });
        expect(
            parseCard({ fullName: "Synthetic", type: "Action", effects: ["The opposing players together choose one of your items and banish it."] }),
        ).toMatchObject({
            rules: {
                effect: {
                    type: "Choose Cards",
                    player: { together: "Opponents" },
                    from: { zone: "Play", player: "You", cardType: "Item" },
                    count: 1,
                    effect: { type: "Banish", cards: "Selected Cards" },
                },
            },
        });
        expect(synthetic("static", "During the opposing players' turn, they may together pay 3 lore to banish this character.")).toMatchObject({
            type: "Activated",
            by: { together: "Opponents" },
            cost: [{ type: "Lose Lore", amount: 3 }],
        });
        expect(synthetic("static", "During the Illumineers' turn, they may pay 3 ⬡ each to banish this character.")).toMatchObject({
            type: "Activated",
            by: { together: "Opponents" },
            cost: [{ type: "Ink", amount: 3, each: true }],
        });
    });

    it("keeps costs separate from an activated effect", () => {
        expect(rules("Magic Mirror")).toEqual({
            type: "Item",
            abilities: [
                {
                    type: "Activated",
                    name: "SPEAK!",
                    cost: [
                        { type: "Exert", cards: "Self" },
                        { type: "Ink", amount: 4 },
                    ],
                    effect: { type: "Draw", player: "You", amount: 1 },
                },
            ],
        });
    });

    it("converts a self-banish cost without banishing the effect target", () => {
        expect(rules("Namaari - Nemesis")).toMatchObject({
            abilities: [
                {
                    type: "Activated",
                    cost: [
                        { type: "Exert", cards: "Self" },
                        { type: "Banish", cards: "Self" },
                    ],
                    effect: {
                        type: "Choose Cards",
                        from: { zone: "Play", cardType: "Character" },
                        count: 1,
                        effect: { type: "Banish", cards: "Selected Cards" },
                    },
                },
            ],
        });
    });

    it("converts a challenge-banish trigger with the correct source", () => {
        expect(rules("Aladdin - Heroic Outlaw")).toMatchObject({
            abilities: [
                { type: "Keyword" },
                {
                    type: "Triggered",
                    name: "DARING EXPLOIT",
                    trigger: {
                        event: "Banish",
                        source: "Self",
                        kind: "Challenge",
                        card: { zone: "Any", cardType: "Character", exclude: "Self" },
                        when: { duringTurnOf: "You" },
                    },
                    effect: {
                        type: "Sequence",
                        effects: [
                            { type: "Gain Lore", player: "You", amount: 2 },
                            { type: "Lose Lore", player: "Opponents", amount: 2 },
                        ],
                    },
                },
            ],
        });
    });

    it("creates a live one-use discount for the next character, not the current hand", () => {
        expect(rules("Lantern")).toMatchObject({
            abilities: [
                {
                    type: "Activated",
                    cost: [{ type: "Exert", cards: "Self" }],
                    effect: {
                        type: "Create Rule",
                        uses: 1,
                        duration: { until: "End Of Turn" },
                        rule: {
                            type: "Modify Cost",
                            cards: { zone: "Any", player: "You", cardType: "Character" },
                            amount: -1,
                            for: "Play",
                        },
                    },
                },
            ],
        });
    });

    it("counts discard characters for Chernabog while the card is still in hand", () => {
        const original = card("Chernabog - Evildoer");
        const ability = original.abilities?.find((entry) => entry.effect?.startsWith("For each character card"));
        if (!ability) throw new Error("Missing Chernabog discount");
        expect(parseCard({ ...original, abilities: [ability] })).toMatchObject({
            supported: true,
            rules: {
                abilities: [
                    {
                        type: "Static",
                        from: ["Hand"],
                        rule: {
                            type: "Modify Cost",
                            cards: "Self",
                            for: "Play",
                            amount: { multiply: [-1, { count: { zone: "Discard", player: "You", cardType: "Character" } }] },
                        },
                    },
                ],
            },
        });
    });

    it("does not apply a printed Shift-only discount to normal play", () => {
        const original = card("Belle - Mechanic Extraordinaire");
        const ability = original.abilities?.find((entry) => entry.effect?.startsWith("For each item card"));
        if (!ability) throw new Error("Missing Belle discount");
        expect(parseCard({ ...original, abilities: [ability] })).toMatchObject({
            supported: true,
            rules: {
                abilities: [
                    {
                        type: "Static",
                        from: ["Hand"],
                        rule: {
                            type: "Modify Cost",
                            cards: "Self",
                            for: "Shift",
                            amount: { multiply: [-1, { count: { zone: "Discard", player: "You", cardType: "Item" } }] },
                        },
                    },
                ],
            },
        });
    });

    it("preserves ownership and readiness when sending a chosen card to ink", () => {
        expect(rules("Let It Go")).toMatchObject({
            effect: {
                type: "Choose Cards",
                count: 1,
                from: { zone: "Play", cardType: "Character" },
                effect: { type: "Move Card", cards: "Selected Cards", to: "Inkwell", exerted: true },
            },
        });
        expect(rules("Hades - Infernal Schemer")).toMatchObject({
            abilities: [
                {
                    type: "Triggered",
                    effect: {
                        type: "Optional",
                        effect: {
                            type: "Choose Cards",
                            from: { zone: "Play", cardType: "Character", player: "Opponents" },
                            count: 1,
                            effect: { type: "Move Card", cards: "Selected Cards", to: "Inkwell" },
                        },
                    },
                },
            ],
        });
    });

    it("expresses stat-dependent continuous bonuses without copying printed stats", () => {
        const parsed = rules("Alice - Growing Girl");
        if (parsed.type === "Action") throw new Error("Expected character");
        expect(parsed.abilities[1]).toMatchObject({
            type: "Static",
            rule: {
                type: "Conditional",
                if: { every: "Self", where: { strength: { atLeast: 10 } } },
                then: { type: "Modify Cards", cards: "Self", modifier: { stat: "Lore", amount: 4 } },
            },
        });
    });

    it("preserves a keyword qualifier on a chosen target", () => {
        expect(parseCard({ fullName: "Synthetic", type: "Action", effects: ["Deal 2 damage to chosen character with Evasive."] })).toMatchObject({
            supported: true,
            rules: { effect: { type: "Choose Cards", from: { where: { keyword: "Evasive" } } } },
        });
    });

    it("keeps an optional ink payment separate from the effect it enables", () => {
        expect(parseCard({ fullName: "Synthetic", type: "Action", effects: ["You may pay 2 ⬡ to draw a card."] })).toMatchObject({
            supported: true,
            rules: {
                effect: {
                    type: "Optional",
                    effect: { type: "Pay Cost", cost: [{ type: "Ink", amount: 2 }], then: { type: "Draw", player: "You", amount: 1 } },
                },
            },
        });
    });

    it("runs an if-you-do follow-up only after fully performing its instruction", () => {
        expect(
            parseCard({ fullName: "Synthetic", type: "Action", effects: ["You may deal 2 damage to chosen character. If you do, draw a card."] }),
        ).toMatchObject({
            supported: true,
            rules: {
                effect: {
                    type: "Optional",
                    effect: {
                        type: "Do Then",
                        do: { type: "Choose Cards", count: 1, effect: { type: "Deal Damage", cards: "Selected Cards", amount: 2 } },
                        then: { type: "Draw", player: "You", amount: 1 },
                    },
                },
            },
        });
    });

    it("converts counts into expressions rather than a fixed draw amount", () => {
        expect(parseCard({ fullName: "Synthetic", type: "Action", effects: ["Draw a card for each item you have in play."] })).toMatchObject({
            supported: true,
            rules: { effect: { type: "Draw", player: "You", amount: { count: { zone: "Play", player: "You", cardType: "Item" } } } },
        });
    });

    it("counts only other undamaged characters when Bolt readies", () => {
        expect(rules("Bolt - Superdog")).toMatchObject({
            abilities: expect.arrayContaining([
                expect.objectContaining({
                    type: "Triggered",
                    trigger: { event: "Ready", card: "Self" },
                    effect: {
                        type: "Gain Lore",
                        player: "You",
                        amount: { count: { zone: "Play", player: "You", cardType: "Character", where: { damage: { equal: 0 } }, exclude: "Self" } },
                    },
                }),
            ]),
        });
    });

    it("matches the banished Broom rather than any banishment earlier in the turn", () => {
        expect(rules("Mickey Mouse - Wayward Sorcerer")).toMatchObject({
            abilities: expect.arrayContaining([
                expect.objectContaining({
                    type: "Triggered",
                    trigger: {
                        event: "Banish",
                        kind: "Challenge",
                        card: { zone: "Any", player: "You", cardType: "Character", where: { classification: "Broom" } },
                    },
                    effect: {
                        type: "Optional",
                        effect: {
                            type: "Move Card",
                            cards: { event: "Card" },
                            to: "Hand",
                        },
                    },
                }),
            ]),
        });
    });

    it("represents end-of-turn conditions as trigger conditions", () => {
        expect(rules("Simba - Pride Protector")).toMatchObject({
            abilities: expect.arrayContaining([
                expect.objectContaining({
                    type: "Triggered",
                    trigger: { event: "Turn End", player: "You", when: { every: "Self", where: { exerted: true } } },
                    effect: { type: "Optional", effect: { type: "Ready", cards: { zone: "Play", cardType: "Character", player: "You", exclude: "Self" } } },
                }),
            ]),
        });
    });

    it("retains same-target scope around conditional readying restrictions", () => {
        const parsed = rules("Daisy Duck - Trendy Traveler");
        expect(parsed).toMatchObject({
            abilities: [
                {
                    type: "Triggered",
                    effect: {
                        type: "Optional",
                        effect: {
                            type: "Choose Cards",
                            count: 1,
                            effect: {
                                type: "Do Then",
                                do: { type: "Ready", cards: "Selected Cards" },
                                then: {
                                    type: "Modify Cards",
                                    cards: "Selected Cards",
                                    modifier: { restriction: "Can't Quest" },
                                    duration: { until: "End Of Turn" },
                                },
                            },
                        },
                    },
                },
            ],
        });
    });

    it("keeps printed conditions and discard payments", () => {
        expect(rules("Milo Thatch - Getting His Hands Dirty")).toMatchObject({
            abilities: [
                { type: "Keyword" },
                {
                    type: "Triggered",
                    effect: {
                        type: "Optional",
                        effect: {
                            type: "Do Then",
                            do: { type: "Choose Cards", from: { zone: "Hand", player: "You" }, count: 1, effect: { type: "Discard", cards: "Selected Cards" } },
                            then: {
                                type: "Choose Cards",
                                from: { zone: "Play", cardType: "Character" },
                                count: 1,
                                effect: { type: "Move Card", cards: "Selected Cards", to: "Hand" },
                            },
                        },
                    },
                },
                {
                    type: "Triggered",
                    trigger: {
                        event: "Turn End",
                        player: "You",
                        when: {
                            value: { countEvents: { event: "Move Card", to: "Discard", player: "You" }, during: "This Turn" },
                            is: { atLeast: 2 },
                        },
                    },
                },
            ],
        });
        expect(rules("The Queen - Conceited Ruler")).toMatchObject({
            abilities: [
                { type: "Keyword" },
                {
                    type: "Triggered",
                    effect: {
                        type: "Optional",
                        effect: {
                            type: "Do Then",
                            do: {
                                type: "Choose Cards",
                                from: { zone: "Hand", cardType: "Character", where: { or: [{ classification: "Princess" }, { classification: "Queen" }] } },
                                effect: { type: "Discard", cards: "Selected Cards" },
                            },
                        },
                    },
                },
            ],
        });
    });

    it("plays the discarded card only when it is an Illusion character", () => {
        expect(rules("Jafar - High Sultan of Lorcana")).toMatchObject({
            abilities: [
                {
                    type: "Triggered",
                    effect: {
                        type: "Optional",
                        effect: {
                            type: "Sequence",
                            effects: [
                                { type: "Draw", player: "You", amount: 1 },
                                {
                                    type: "Choose Cards",
                                    from: { zone: "Hand", player: "You" },
                                    count: 1,
                                    effect: {
                                        type: "Sequence",
                                        effects: [
                                            { type: "Discard", cards: "Selected Cards" },
                                            {
                                                type: "Conditional",
                                                if: {
                                                    exists: {
                                                        filter: { result: "Discarded Cards" },
                                                        where: { cardType: "Character", classification: "Illusion" },
                                                    },
                                                },
                                                then: { type: "Optional", effect: { type: "Play", cards: "Selected Cards", free: true } },
                                            },
                                        ],
                                    },
                                },
                            ],
                        },
                    },
                },
            ],
        });
    });

    it("preserves printed ability order and numeric keyword parameters", () => {
        expect(rules("Hercules - Divine Hero")).toEqual({
            type: "Character",
            abilities: [
                { type: "Keyword", keyword: { name: "Shift", cost: [{ type: "Ink", amount: 4 }] } },
                { type: "Keyword", keyword: { name: "Resist", amount: 2 } },
            ],
        });
    });

    it("uses one triggered ability for Merlin entering or leaving play", () => {
        expect(rules("Merlin - Goat")).toEqual({
            type: "Character",
            abilities: [
                {
                    type: "Triggered",
                    name: "HERE I COME!",
                    trigger: {
                        anyOf: [
                            { event: "Play", card: "Self" },
                            { event: "Leave Play", card: "Self" },
                        ],
                    },
                    effect: { type: "Gain Lore", player: "You", amount: 1 },
                },
            ],
        });
    });

    it("draws for actual damage removed, not the requested healing amount", () => {
        expect(rules("Rapunzel - Gifted with Healing")).toEqual({
            type: "Character",
            abilities: [
                {
                    type: "Triggered",
                    name: "GLEAM AND GLOW",
                    trigger: { event: "Play", card: "Self" },
                    effect: {
                        type: "Choose Cards",
                        from: { zone: "Play", cardType: "Character", player: "You" },
                        count: 1,
                        effect: {
                            type: "Sequence",
                            effects: [
                                { type: "Remove Damage", cards: "Selected Cards", amount: { upTo: 3 } },
                                { type: "Draw", player: "You", amount: { result: "Damage Removed" } },
                            ],
                        },
                    },
                },
            ],
        });
    });

    it("captures Kida targets at resolution but keeps Atlantis a live rule", () => {
        const kida = rules("Kida - Protector of Atlantis");
        expect(kida.type).toBe("Character");
        if (kida.type === "Action") throw new Error("Expected character rules");
        expect(kida.abilities[1]).toEqual({
            type: "Triggered",
            name: "PERHAPS WE CAN SAVE OUR FUTURE",
            trigger: { event: "Play", card: "Self" },
            effect: {
                type: "Modify Cards",
                cards: { zone: "Play", cardType: "Character" },
                modifier: { stat: "Strength", amount: -3 },
                duration: { until: "Start Of Next Turn", player: "You" },
            },
        });
        expect(rules("Restoring Atlantis")).toEqual({
            type: "Action",
            effect: {
                type: "Create Rule",
                rule: { type: "Modify Cards", cards: { zone: "Play", cardType: "Character", player: "You" }, modifier: { restriction: "Can't Be Challenged" } },
                duration: { until: "Start Of Next Turn", player: "You" },
            },
        });
    });

    it("stores Rapunzel protection on the supported character, with expiration", () => {
        const parsed = rules("Rapunzel - Ready for Adventure");
        if (parsed.type === "Action") throw new Error("Expected character rules");
        expect(parsed.abilities[1]).toEqual({
            type: "Triggered",
            name: "ACT OF KINDNESS",
            trigger: { event: "Chosen For Support", card: { zone: "Any", cardType: "Character", player: "You" } },
            effect: {
                type: "Modify Cards",
                cards: { event: "Card" },
                modifier: { preventDamage: "Next" },
                duration: { until: "Start Of Next Turn", player: "You" },
            },
        });
    });

    it("redirects Ursula replay only after resolving the song", () => {
        expect(rules("Ursula - Deceiver of All")).toEqual({
            type: "Character",
            abilities: [
                {
                    type: "Triggered",
                    name: "WHAT A DEAL",
                    trigger: { event: "Sing", card: "Self" },
                    effect: {
                        type: "Optional",
                        effect: {
                            type: "Play",
                            cards: { filter: { event: "Song" }, where: { zone: "Discard", player: "You" } },
                            free: true,
                            afterwards: "Deck Bottom",
                        },
                    },
                },
            ],
        });
    });

    it("partitions looked-at cards without a second deck query or arbitrary aliases", () => {
        expect(rules("Ursula's Cauldron")).toEqual({
            type: "Item",
            abilities: [
                {
                    type: "Activated",
                    name: "PEER INTO THE DEPTHS",
                    cost: [{ type: "Exert", cards: "Self" }],
                    effect: {
                        type: "Sequence",
                        effects: [
                            { type: "Look", cards: { zone: "Deck", player: "You", position: "Top", take: 2 } },
                            {
                                type: "Choose Cards",
                                from: { result: "Looked At Cards" },
                                count: 1,
                                effect: {
                                    type: "Sequence",
                                    effects: [
                                        { type: "Move Card", cards: "Selected Cards", to: "Deck", position: "Top" },
                                        {
                                            type: "Move Card",
                                            cards: { difference: [{ result: "Looked At Cards" }, "Selected Cards"] },
                                            to: "Deck",
                                            position: "Bottom",
                                        },
                                    ],
                                },
                            },
                        ],
                    },
                },
            ],
        });
    });

    it.each([
        ["Dalmatian Puppy - Tail Wagger", 99],
        ["The Glass Slipper", 2],
    ] as const)("keeps deck construction in the printed slot for %s", (name, maxCopies) => {
        const parsed = rules(name);
        if (parsed.type === "Action") throw new Error("Expected non-action rules");
        expect(parsed.abilities[0]).toMatchObject({ type: "Deck Construction", maxCopies });
        expect(parsed.abilities).toHaveLength(card(name).abilities?.length ?? 0);
    });

    it("counts Microbots in play and preserves both printed slots", () => {
        const parsed = rules("Microbots");
        if (parsed.type === "Action") throw new Error("Expected item rules");
        expect(parsed.abilities[0]).toEqual({ type: "Deck Construction", maxCopies: "Unlimited", name: "LIMITLESS APPLICATIONS" });
        expect(parsed.abilities[1]).toEqual({
            type: "Triggered",
            name: "INSPIRED TECH",
            trigger: { event: "Play", card: "Self" },
            effect: {
                type: "Choose Cards",
                from: { zone: "Play", cardType: "Character" },
                count: 1,
                effect: {
                    type: "Modify Cards",
                    cards: "Selected Cards",
                    modifier: {
                        stat: "Strength",
                        amount: { multiply: [-1, { count: { zone: "Play", player: "You", cardType: "Item", where: { name: "Microbots" } } }] },
                    },
                    duration: { until: "End Of Turn" },
                },
            },
        });
    });

    it.each(["Draw 2 cards. Then discard a card at random and dance.", "Draw 2 cards and"])(
        "does not treat a supported prefix as full coverage: %s",
        (text) => {
            const parsed = parseCard({ fullName: "Synthetic", type: "Action", effects: [text] });
            expect(parsed.supported).toBe(false);
            expect(parsed).not.toHaveProperty("rules");
        },
    );

    it("reads a sentence that follows a complete instruction", () => {
        expect(parseCard({ fullName: "Synthetic", type: "Action", effects: ["Draw 2 cards. Then discard a card."] })).toMatchObject({
            supported: true,
            rules: {
                effect: {
                    type: "Sequence",
                    effects: [
                        { type: "Draw", player: "You", amount: 2 },
                        { type: "Choose Cards", from: { zone: "Hand", player: "You" }, count: 1, effect: { type: "Discard", cards: "Selected Cards" } },
                    ],
                },
            },
        });
    });

    it("handles whitespace but never parses the printed title as effect text", () => {
        const original = card("Rapunzel - Gifted with Healing");
        const modified = { ...original, abilities: original.abilities?.map((ability) => ({ ...ability })) };
        const first = modified.abilities?.[0];
        if (!first?.effect) throw new Error("Missing fixture effect");
        first.fullText = "DELIBERATELY NOT PARSEABLE";
        first.effect = first.effect.replace(/ /g, "\n  ");
        expect(parseCard(modified)).toEqual(parseCard(original));
    });

    it("rejects an unknown cost rather than making the ability free", () => {
        const result = parseCard({
            fullName: "Synthetic",
            type: "Item",
            abilities: [{ type: "activated", costs: ["⟳", "Discard your entire hand"], effect: "Draw a card.", fullText: "" }],
        });
        expect(result.supported).toBe(false);
    });

    it("does not treat a different card copy limit as this card copy limit", () => {
        const result = parseCard({
            fullName: "Synthetic",
            type: "Item",
            abilities: [{ type: "static", effect: "You may have 99 copies of Some Other Card in your deck.", fullText: "" }],
        });
        expect(result.supported).toBe(false);
    });

    it("keeps Sing Together in action play rules rather than character keywords", () => {
        const ability = { type: "keyword", keyword: "Sing Together", keywordValueNumber: 7, fullText: "Sing Together 7" };
        expect(parseCard({ fullName: "Synthetic", type: "Action", abilities: [ability], effects: ["Draw a card."] })).toMatchObject({
            supported: true,
            rules: { playRules: [{ type: "Sing Together", cost: 7 }] },
        });
        expect(parseCard({ fullName: "Synthetic", type: "Character", abilities: [ability] }).supported).toBe(false);
    });

    it("does not guess unfamiliar Shift variants", () => {
        const ability = { type: "keyword", keyword: "Unknown Shift", keywordValueNumber: 3, fullText: "Unknown Shift 3" };
        expect(parseCard({ fullName: "Synthetic", type: "Character", abilities: [ability] }).supported).toBe(false);
    });

    it("reads Shift costs from the printed text", () => {
        const ability = { type: "keyword", keyword: "Shift", keywordValue: "Discard a song card", fullText: "Shift: Discard a song card" };
        expect(parseCard({ fullName: "Synthetic", type: "Character", abilities: [ability] })).toMatchObject({
            supported: true,
            rules: {
                abilities: [
                    {
                        type: "Keyword",
                        keyword: {
                            name: "Shift",
                            cost: [
                                {
                                    type: "Choose Cards",
                                    from: { zone: "Hand", player: "You", where: { cardType: "Action", song: true } },
                                    count: 1,
                                    cost: [{ type: "Discard", cards: "Selected Cards" }],
                                },
                            ],
                        },
                    },
                ],
            },
        });
    });

    it("supports vanilla characters but never invents an empty action effect", () => {
        expect(parseCard({ fullName: "Vanilla", type: "Character" })).toMatchObject({ supported: true, rules: { type: "Character", abilities: [] } });
        expect(parseCard({ fullName: "Missing", type: "Action" }).supported).toBe(false);
        expect(parseCard({ fullName: "Unknown", type: "Something Else" }).supported).toBe(false);
        expect(parseCard({ fullName: "Vanilla", type: "Character", effects: ["This is flavor text."] })).toMatchObject({
            supported: true,
            rules: { type: "Character", abilities: [] },
        });
    });

    it("reports where unrecognized text begins", () => {
        const unknown = parseCard({ fullName: "Synthetic", type: "Action", effects: ["Draw a card. Unknown instruction."] });
        if (unknown.supported) throw new Error("Expected a coverage gap");
        expect(unknown.issues).toEqual([
            { source: "Effect", index: 0, text: "Draw a card. Unknown instruction.", reason: expect.stringContaining("⟪Unknown instruction.⟫") },
        ]);
    });

    it("discards every player hand before drawing replacements", () => {
        expect(rules("A Whole New World")).toMatchObject({
            effect: {
                type: "For Each Player",
                players: "All",
                effect: {
                    type: "Sequence",
                    effects: [
                        { type: "Discard", cards: { zone: "Hand", player: "Selected Player" } },
                        { type: "Draw", player: "Selected Player", amount: 7 },
                    ],
                },
            },
        });
    });

    it("models Mim bounce as an alternative that must be fully performable", () => {
        expect(rules("Madam Mim - Fox")).toMatchObject({
            abilities: expect.arrayContaining([
                expect.objectContaining({
                    type: "Triggered",
                    effect: {
                        type: "Or",
                        options: [
                            { type: "Banish", cards: "Self" },
                            {
                                type: "Choose Cards",
                                count: 1,
                                from: { zone: "Play", cardType: "Character", player: "You", exclude: "Self" },
                                effect: { type: "Move Card", cards: "Selected Cards", to: "Hand" },
                            },
                        ],
                    },
                }),
            ]),
        });
    });

    it("looks even when no cards are taken, revealing only the cards taken", () => {
        expect(rules("Look at This Family")).toMatchObject({
            effect: {
                type: "Sequence",
                effects: [
                    { type: "Look", cards: { zone: "Deck", player: "You", take: 5 } },
                    {
                        type: "Choose Cards",
                        from: { filter: { result: "Looked At Cards" }, where: { cardType: "Character" } },
                        count: { upTo: 2 },
                        effect: {
                            type: "Sequence",
                            effects: [
                                { type: "Reveal", cards: "Selected Cards" },
                                { type: "Move Card", cards: "Selected Cards", to: "Hand" },
                                {
                                    type: "Move Card",
                                    cards: { difference: [{ result: "Looked At Cards" }, "Selected Cards"] },
                                    to: "Deck",
                                    position: "Bottom",
                                    order: "Chosen",
                                },
                            ],
                        },
                    },
                ],
            },
        });
    });

    it("keeps both chosen endpoints and the up-to budget when moving damage", () => {
        expect(rules("Belle - Accomplished Mystic")).toMatchObject({
            abilities: expect.arrayContaining([
                expect.objectContaining({
                    type: "Triggered",
                    effect: {
                        type: "Choose Cards",
                        from: { zone: "Play", cardType: "Character" },
                        count: 1,
                        effect: {
                            type: "Choose Cards",
                            from: { zone: "Play", cardType: "Character", player: "Opponents" },
                            count: 1,
                            effect: { type: "Move Damage", from: "Parent Selected Cards", to: "Selected Cards", amount: { upTo: 3 } },
                        },
                    },
                }),
            ]),
        });
    });

    it("preserves exact printed cost on a free-play effect", () => {
        const parsed = rules("Pocahontas - Guiding the Tribe");
        expect(parsed).toMatchObject({
            abilities: expect.arrayContaining([
                expect.objectContaining({
                    effect: {
                        type: "Optional",
                        effect: {
                            type: "Choose Cards",
                            from: { zone: "Hand", player: "You", cardType: "Character", where: { cost: { equal: 1 } } },
                            count: 1,
                            effect: { type: "Play", cards: "Selected Cards", free: true },
                        },
                    },
                }),
            ]),
        });
    });

    it("reports every catalog entry and validates all complete outputs", () => {
        const report = parseCatalog(catalog.cards);
        expect(report.summary.printings).toBe(catalog.cards.length);
        expect(report.unsupported).toEqual([]);
        expect(report.parsed).toHaveLength(catalog.cards.length);
        expect(report.summary.supportedSlots).toBe(report.summary.slots);
        for (const entry of report.parsed) {
            expect(validateCardRules(entry.rules), entry.card).toEqual([]);
            expect(JSON.parse(JSON.stringify(entry.rules))).toEqual(entry.rules);
            const raw = catalog.cards[entry.index];
            if (!raw) throw new Error("Invalid catalog index");
            if (entry.rules.type !== "Action") expect(entry.rules.abilities).toHaveLength(raw.abilities?.length ?? 0);
        }
    });

    it("counts other Pirates relative to the source, not the chosen damage target", () => {
        expect(
            synthetic(
                "triggered",
                "When you play this character, you may deal damage to chosen character equal to the number of your other Pirate characters in play.",
            ),
        ).toMatchObject({
            effect: {
                type: "Optional",
                effect: {
                    type: "Choose Cards",
                    effect: {
                        type: "Deal Damage",
                        amount: { count: { player: "You", exclude: "Self", where: { classification: "Pirate" } } },
                    },
                },
            },
        });
    });

    it("reuses the chosen character when a conditional stat change happens instead", () => {
        const parsed = synthetic(
            "triggered",
            "When you play this character, chosen character gets -1 ¤ this turn. If you have a character named Darkwing Duck in play, chosen character gets -2 ¤ this turn instead.",
        );
        expect(parsed).toMatchObject({
            effect: {
                type: "Choose Cards",
                effect: {
                    type: "Conditional",
                    then: { type: "Modify Cards", cards: "Selected Cards", modifier: { stat: "Strength", amount: -2 } },
                    otherwise: { type: "Modify Cards", cards: "Selected Cards", modifier: { stat: "Strength", amount: -1 } },
                },
            },
        });
    });

    it("reads the questing character’s location lore, not its own lore", () => {
        const parsed = synthetic("triggered", "Whenever this character quests while at a location, draw cards equal to that location's ◊.");
        expect(parsed).toMatchObject({ type: "Triggered", effect: { type: "Draw", player: "You", amount: { stat: "Lore", card: { locationOf: "Self" } } } });
    });

    it("does not shuffle the found Floodborn back after putting it into hand", () => {
        expect(
            synthetic(
                "triggered",
                "Whenever this character quests, reveal cards from the top of your deck until you reveal a Floodborn character card. Put that card into your hand and shuffle the rest into your deck.",
            ),
        ).toMatchObject({
            effect: {
                type: "Sequence",
                effects: [
                    { type: "Reveal Until" },
                    { type: "Move Card", to: "Hand" },
                    {
                        type: "Move Card",
                        to: "Deck",
                        cards: {
                            difference: [
                                { result: "Revealed Cards" },
                                { filter: { result: "Revealed Cards" }, where: { cardType: "Character", classification: "Floodborn" } },
                            ],
                        },
                    },
                ],
            },
        });
    });

    it("represents conditional free play as an alternate cost from hand", () => {
        expect(rules("Club Door").abilities?.[0]).toMatchObject({
            type: "Static",
            from: ["Hand"],
            rule: { type: "Conditional", then: { type: "Alternate Cost", cost: [] } },
        });
    });

    it("keeps each opponent as the owner when you choose a character of theirs", () => {
        expect(rules("Eeyore - In the Way").abilities?.[1]).toMatchObject({
            type: "Triggered",
            effect: {
                type: "For Each Player",
                players: "Opponents",
                effect: { type: "Optional", effect: { type: "Choose Cards", from: { player: "Selected Player", cardType: "Character" } } },
            },
        });
    });

    it("makes a conditional Shift grant available before the character is played", () => {
        expect(rules("Anna - Soothing Sister").abilities?.[0]).toMatchObject({
            type: "Static",
            from: ["Hand", "Play", "Discard", "Under", "Inkwell"],
            rule: {
                type: "Conditional",
                then: {
                    type: "Modify Cards",
                    cards: "Self",
                    modifier: {
                        gainAbility: { type: "Keyword", keyword: { name: "Shift", cost: [{ type: "Ink", amount: 0 }] } },
                    },
                },
            },
        });
    });

    it("groups duplicate wordings but does not conceal an unsupported reprint", () => {
        const unsupported: CatalogCard = { fullName: "Same", type: "Action", effects: ["Unknown instruction."] };
        const report = parseCatalog([{ fullName: "Same", type: "Action", effects: ["Draw a card."] }, unsupported, unsupported]);
        expect(report.summary.supportedPrintings).toBe(1);
        expect(report.parsed.map((entry) => entry.index)).toEqual([0]);
        expect(report.unsupported).toHaveLength(1);
        expect(report.unsupported[0]?.cards).toEqual(["Same"]);
    });
});
