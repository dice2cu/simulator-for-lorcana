import { describe, expect, it } from "vitest";
import type { CatalogCard } from "../cards";
import { abilityTestFileName, abilityTestInventory, abilityTestStub, effectId, updateAbilityCardList } from "../scripts/ability-test-files";

const entry = {
    id: effectId("Draw a card."),
    text: "Draw a card.",
    cards: ["First Card", "Second Card"],
};

function card(fullName: string, abilities: CatalogCard["abilities"] = []): CatalogCard {
    return {
        id: 1,
        setCode: "1",
        fullName,
        name: fullName,
        fullText: "",
        type: "Character",
        color: "Amber",
        cost: 1,
        inkwell: true,
        abilities,
    };
}

describe("Generated effect tests", () => {
    it("keeps the original whitespace-normalized effect ID and filename", () => {
        expect(effectId(" Draw   a\ncard. ")).toBe(entry.id);
        expect(abilityTestFileName(entry)).toBe(`draw-a-card-${entry.id}.test.ts`);
    });

    it("updates only the list and preserves manually completed assertions exactly", () => {
        const source = abilityTestStub(entry).replace(
            "expect.fail('TODO: use ' + prototypeCardName + ' to verify this ability');",
            "player.action(action => action.type === 'End Turn');\n        expect(result.players[1]?.lore).toBe(7);",
        );
        const updated = updateAbilityCardList(source, { ...entry, cards: ["New Prototype"] });
        const list = (text: string) =>
            text.slice(text.indexOf("// BEGIN GENERATED CARD LIST") + "// BEGIN GENERATED CARD LIST".length, text.indexOf("// END GENERATED CARD LIST"));
        expect(updated.replace(list(updated), "")).toBe(source.replace(list(source), ""));
        expect(updated).toContain('"New Prototype",');
        expect(updated).toContain("expect(result.players[1]?.lore).toBe(7);");
        expect(updateAbilityCardList(updated, { ...entry, cards: ["New Prototype"] })).toBe(updated);
    });

    it("preserves Windows newlines and unmanaged tests", () => {
        const source = abilityTestStub(entry).replace(/\n/g, "\r\n");
        const updated = updateAbilityCardList(source, { ...entry, cards: ["New"] });
        expect(updated.replace(/\r\n/g, "")).not.toContain("\n");
        const unmanaged = `// Generated ability ID: ${entry.id}\nexpect(7).toBe(7);`;
        expect(updateAbilityCardList(unmanaged, entry)).toBe(unmanaged);
    });

    it("rejects mismatched IDs instead of modifying the wrong test", () => {
        expect(() => updateAbilityCardList(abilityTestStub(entry), { ...entry, id: "bad" })).toThrow();
    });

    it("creates an explicitly failing stub with a list-derived prototype", () => {
        const source = abilityTestStub(entry);
        expect(source).toContain("const prototypeCardName = cardsWithEffect[0];");
        expect(source).toContain("expect.fail('TODO:");
        expect(source).toContain("const player = new ScriptedPlayer();");
        expect(source).not.toContain("TestHarness");
        expect(source).not.toContain(".skip(");
    });

    it("groups identical effects without their printed ability names", () => {
        const entries = abilityTestInventory([
            card("One", [
                {
                    type: "triggered",
                    name: "FIRST TITLE",
                    fullText: "FIRST TITLE Draw a card.",
                    effect: entry.text,
                },
            ]),
            card("Two", [
                {
                    type: "triggered",
                    name: "SECOND TITLE",
                    fullText: "SECOND TITLE Draw a card.",
                    effect: entry.text,
                },
            ]),
        ]);
        expect(entries).toEqual([{ ...entry, cards: ["One", "Two"] }]);
    });

    it("uses the first printing and sorts the simpler prototype first", () => {
        const entries = abilityTestInventory([
            card("Activated", [{ type: "activated", fullText: entry.text, effect: entry.text, costs: ["1"] }]),
            card("Trigger", [{ type: "triggered", fullText: entry.text, effect: entry.text }]),
            { ...card("Action"), type: "Action", effects: [entry.text] },
            { ...card("Action"), type: "Action", effects: ["Gain 9 lore."] },
        ]);
        expect(entries).toEqual([{ ...entry, cards: ["Action", "Trigger", "Activated"] }]);
    });
});
