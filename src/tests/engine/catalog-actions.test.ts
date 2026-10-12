import { expect, it } from "vitest";
import { cards, getCard } from "../../cards";
import { getLegalActions } from "../../engine/actions";
import { startAction } from "../../engine/engine";
import { resumeAction } from "../../engine/resume";
import { completeCatalogResolution } from "./catalog-driver";
import type { GameState, PlayerPosition } from "../../model/game-state";
import type { CharacterCard, ItemCard } from "../../model/card";

const neutral: CharacterCard = {
    fullName: "Catalog Action Fixture",
    names: ["Catalog Action Fixture"],
    type: "Character",
    colors: ["Amber"],
    subtypes: ["Hero"],
    cost: 1,
    inkwell: true,
    strength: 1,
    willpower: 20,
    lore: 1,
};
const lookup = (name: string) => (name === neutral.fullName ? neutral : getCard(name));

it("does not silently turn printed actions into empty instruction lists", () => {
    const empty = cards.filter((card) => card.type === "Action" && card.fullText && card.effect.type === "Sequence" && !card.effect.effects.length);
    expect(empty.map((card) => card.fullName)).toEqual([]);
});

it("executes every catalog Shift variant with physical stack conservation", () => {
    const failures: string[] = [];
    for (const definition of new Map(cards.filter((card) => card.type === "Character").map((card) => [card.fullName, card])).values()) {
        for (const [ability, printed] of (definition.abilities ?? []).entries()) {
            if (printed.type !== "Keyword" || printed.keyword.name !== "Shift") continue;
            const shift = printed.keyword,
                names = shift.names ?? definition.names.slice(-2);
            const classification = shift.onto && typeof shift.onto === "object" && "zone" in shift.onto ? shift.onto.where?.classification : undefined;
            const bases: (CharacterCard | ItemCard)[] = names.map((name, i) => ({
                ...neutral,
                fullName: `Shift Base ${i}`,
                names: [name],
                subtypes: [...definition.subtypes, ...(classification ? [classification] : [])],
                strength: 1,
                willpower: 50,
                lore: 0,
            }));
            bases.push({ ...neutral, type: "Item", fullName: "Shift Potato", names: ["Potato"] });
            const custom = (name: string) => bases.find((base) => base.fullName === name) ?? lookup(name);
            const state = fixture(definition.fullName),
                player = state.players[1],
                card = { fullName: definition.fullName, i: 1 };
            if (!player) throw new Error("Missing shift player");
            player.play.push(...bases.map((base, i) => ({ card: { fullName: base.fullName, i: 300 + i } })));
            player.hand.push(...[151, 152, 153].map((i) => ({ fullName: neutral.fullName, i })));
            player.hand.push(
                ...["Friends on the Other Side", "Dinglehopper", "The Sorcerer's Tower - Wondrous Workspace"].map((fullName, i) => ({ fullName, i: 500 + i })),
            );
            try {
                const action = getLegalActions(state, { card: custom }).find(
                    (action) => action.type === "Shift" && "ability" in action && action.ability === ability,
                );
                if (!action) throw new Error("Missing Shift intention");
                const live = startAction(state, action, { card: custom });
                completeCatalogResolution(live, { card, player: 1, kind: "Ability" }, { card: custom }, state);
                expect(resumeAction(state, JSON.parse(JSON.stringify(live.turn.steps)), { card: custom }).result).toEqual(live.result);
            } catch (error) {
                failures.push(`${definition.fullName}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }
    expect(failures).toEqual([]);
});

function fixture(fullName: string): GameState {
    const player = (offset: number): PlayerPosition => ({
        lore: 5,
        turnsTaken: 1,
        hand: [],
        discard: [{ fullName: neutral.fullName, i: offset + 40 }],
        deck: Array.from({ length: 8 }, (_, i) => ({ fullName: neutral.fullName, i: offset + i })),
        inkwell: Array.from({ length: 12 }, (_, i) => ({ card: { fullName: neutral.fullName, i: offset + i + 10 }, exerted: false })),
        play: [{ card: { fullName: neutral.fullName, i: offset + 30 }, exerted: true, damage: 2 }],
    });
    const p1 = player(100),
        p2 = player(200);
    p1.hand = [
        { fullName, i: 1 },
        { fullName: neutral.fullName, i: 150 },
    ];
    return { turn: { number: 3, player: 1 }, players: { 1: p1, 2: p2 } };
}

it("executes every normally playable catalog card through play, choices and random outcomes", () => {
    const failures: string[] = [];
    for (const definition of new Map(cards.map((card) => [card.fullName, card])).values()) {
        const card = { fullName: definition.fullName, i: 1 };
        const state = fixture(definition.fullName);
        try {
            const action = getLegalActions(state, { card: lookup }).find((action) => action.type === "Play");
            if (!action) {
                if (definition.playRules?.some((rule) => rule.type === "Requirement")) continue;
                throw new Error("Missing normal play");
            }
            const live = startAction(state, action, { card: lookup });
            completeCatalogResolution(live, { card, player: 1, kind: definition.type === "Action" ? "Action" : "Ability" }, { card: lookup }, state);
            expect(resumeAction(state, JSON.parse(JSON.stringify(live.turn.steps)), { card: lookup }).result).toEqual(live.result);
        } catch (error) {
            failures.push(`${definition.fullName}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    expect(failures).toEqual([]);
});

it("executes legal catalog activations, Boost, quests and challenges", () => {
    const failures: string[] = [];
    for (const definition of new Map(cards.filter((card) => card.type !== "Action").map((card) => [card.fullName, card])).values()) {
        const card = { fullName: definition.fullName, i: 1 },
            state = fixture(definition.fullName);
        const p1 = state.players[1];
        if (!p1) throw new Error("Missing player");
        p1.hand = p1.hand.slice(1);
        p1.play.push({ card });
        try {
            const actions = getLegalActions(state, { card: lookup }).filter(
                (action) => action.type === "Activate" || action.type === "Boost" || action.type === "Quest" || action.type === "Challenge",
            );
            for (const action of actions) {
                try {
                    completeCatalogResolution(startAction(state, action, { card: lookup }), { card, player: 1, kind: "Ability" }, { card: lookup }, state);
                } catch (error) {
                    failures.push(`${definition.fullName} ${action.type}: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
        } catch (error) {
            failures.push(`${definition.fullName}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    expect(failures).toEqual([]);
});

it("resolves alternate catalog decisions and optional payments without losing cards, and reconstructs every input", () => {
    const failures: string[] = [];
    let completed = 0;
    for (const definition of new Map(cards.map((card) => [card.fullName, card])).values()) {
        const card = { fullName: definition.fullName, i: 1 };
        const state = fixture(definition.fullName);
        const p1 = state.players[1];
        if (!p1) throw new Error("Missing player");
        if (definition.type !== "Action") {
            p1.hand = p1.hand.slice(1);
            p1.play.push({ card });
        }
        try {
            const actions = getLegalActions(state, { card: lookup }).filter((action) =>
                definition.type === "Action"
                    ? action.type === "Play"
                    : action.type === "Activate" || action.type === "Boost" || action.type === "Quest" || action.type === "Challenge",
            );
            for (const action of actions)
                for (const acceptOptional of [true, false]) {
                    try {
                        const live = startAction(state, action, { card: lookup });
                        completeCatalogResolution(
                            live,
                            { card, player: 1, kind: definition.type === "Action" ? "Action" : "Ability" },
                            { card: lookup },
                            state,
                            undefined,
                            true,
                            { last: true, payOptional: true, acceptOptional },
                        );
                        expect(resumeAction(state, JSON.parse(JSON.stringify(live.turn.steps)), { card: lookup }).result).toEqual(live.result);
                        completed++;
                    } catch (error) {
                        failures.push(
                            `${definition.fullName} ${action.type} optional=${acceptOptional}: ${error instanceof Error ? error.message : String(error)}`,
                        );
                    }
                }
        } catch (error) {
            failures.push(`${definition.fullName}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    expect(failures).toEqual([]);
    expect(completed).toBeGreaterThan(1000);
}, 120000);
