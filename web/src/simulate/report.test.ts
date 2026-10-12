import { describe, expect, it } from "vitest";
import { reportMarkdown, type Report } from "./report";

describe("Markdown simulation report", () => {
    it("includes rankings, records, confidence intervals, seat splits and errors", () => {
        const record = { wins: 3, games: 4, rate: 0.75, low: 0.3, high: 0.95 };
        const report: Report = {
            rankings: [{ name: "My | deck", vsReference: record }],
            references: [{ name: "Reference", record: { ...record, wins: 1, rate: 0.25 } }],
            matchups: [
                {
                    first: "My | deck",
                    second: "Reference",
                    againstReference: true,
                    record,
                    play: { ...record, wins: 2, games: 2, rate: 1 },
                    draw: { ...record, wins: 1, games: 2, rate: 0.5 },
                    undecided: 2,
                },
            ],
            games: 6,
            unfinished: 1,
            errors: [{ message: "Bad | input\nagain", count: 1 }],
        };
        const markdown = reportMarkdown(report);
        expect(markdown).toContain("| 1 | My \\| deck | 75% [30%–95%] | — |");
        expect(markdown).toContain("| My \\| deck | Reference | 3–1 | 75% [30%–95%] | 100% | 50% | 2 |");
        expect(markdown).toContain("## Reference decks against the tested decks");
        expect(markdown).toContain("6 games, 1 stopped at 100 turns, 1 failed.");
        expect(markdown).toContain("| 1 | Bad \\| input again |");
        expect(markdown).not.toContain("CHECK:");
    });

    it("handles results with no decided games or references", () => {
        const record = { wins: 0, games: 0, rate: NaN, low: 0, high: 1 };
        const markdown = reportMarkdown({
            rankings: [{ name: "Deck", vsOthers: record }],
            references: [],
            matchups: [{ first: "Deck", second: "Other", againstReference: false, record, play: record, draw: record, undecided: 1 }],
            games: 1,
            unfinished: 1,
            errors: [],
        });
        expect(markdown).toContain("| Deck | Other | 0–0 | — | — | — | 1 |");
        expect(markdown).not.toContain("NaN");
        expect(markdown).not.toContain("## Reference decks");
        expect(markdown).not.toContain("## Errors");
    });
});
