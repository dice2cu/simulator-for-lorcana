import { averageRecord, matchupRecord, percent, wilson, type Deck, type Job, type Matchup } from "../simulator";

export interface Rate {
    readonly wins: number;
    readonly games: number;
    /** For averages, the mean of per-opponent rates, so each opponent counts equally. */
    readonly rate: number;
    /** 95% interval over all games. */
    readonly low: number;
    readonly high: number;
}

export interface MatchupRow {
    readonly first: string;
    readonly second: string;
    readonly againstReference: boolean;
    readonly record: Rate;
    readonly play: Rate;
    readonly draw: Rate;
    readonly undecided: number;
}

export interface Report {
    /** Tested decks, best first. */
    readonly rankings: readonly { name: string; vsReference?: Rate; vsOthers?: Rate }[];
    /** Reference decks' average against the tested decks. */
    readonly references: readonly { name: string; record: Rate }[];
    readonly matchups: readonly MatchupRow[];
    readonly games: number;
    readonly unfinished: number;
    readonly errors: readonly { message: string; count: number }[];
}

const rate = (wins: number, games: number, average = games ? wins / games : NaN): Rate => {
    const [low, high] = wilson(wins, games);
    return { wins, games, rate: average, low, high };
};

/** Export the displayed results, without the CLI's diagnostic warnings. */
export function reportMarkdown(report: Report): string {
    const cell = (value: string): string =>
        value
            .replace(/\\/g, "\\\\")
            .replace(/\|/g, "\\|")
            .replace(/[\r\n]+/g, " ");
    const interval = (value?: Rate): string => (value?.games ? `${percent(value.rate)} [${percent(value.low)}–${percent(value.high)}]` : "—");
    const table = (headers: string[], rows: string[][]): string =>
        [headers, headers.map(() => "---"), ...rows].map((row) => `| ${row.map(cell).join(" | ")} |`).join("\n");
    const sections = [
        "# Simulation report",
        "## Deck rankings\n\n" +
            table(
                ["Rank", "Deck", "vs reference (95% CI)", "vs tested (95% CI)"],
                report.rankings.map((row, index) => [String(index + 1), row.name, interval(row.vsReference), interval(row.vsOthers)]),
            ),
        "## Matchups\n\n" +
            table(
                ["Deck", "Opponent", "Won–lost", "Win rate (95% CI)", "On the play", "On the draw", "Undecided"],
                report.matchups.map((row) => [
                    row.first,
                    row.second,
                    `${row.record.wins}–${row.record.games - row.record.wins}`,
                    interval(row.record),
                    row.play.games ? percent(row.play.rate) : "—",
                    row.draw.games ? percent(row.draw.rate) : "—",
                    String(row.undecided),
                ]),
            ),
    ];
    if (report.references.length)
        sections.push(
            "## Reference decks against the tested decks\n\n" +
                table(
                    ["Deck", "Won–lost", "Win rate (95% CI)"],
                    report.references.map((row) => [row.name, `${row.record.wins}–${row.record.games - row.record.wins}`, interval(row.record)]),
                ),
        );
    sections.push(`${report.games} games, ${report.unfinished} stopped at 100 turns, ${report.errors.reduce((sum, error) => sum + error.count, 0)} failed.`);
    if (report.errors.length)
        sections.push(
            "## Errors\n\n" +
                table(
                    ["Count", "Message"],
                    report.errors.map((error) => [String(error.count), error.message]),
                ),
        );
    return sections.join("\n\n") + "\n";
}

/** The same summary as the command line's report, as data. */
export function summarize(decks: readonly Deck[], matchups: readonly Matchup[], jobs: readonly Job[]): Report {
    const average = (deck: number, against: (other: Deck) => boolean): Rate => {
        const result = averageRecord(decks, matchups, jobs, deck, against);
        return rate(result.wins, result.games, result.rate);
    };
    const tested = decks.map((deck, index) => ({ deck, index })).filter(({ deck }) => !deck.reference);
    const references = decks.map((deck, index) => ({ deck, index })).filter(({ deck }) => deck.reference);
    const rankings = tested
        .map(({ deck, index }) => ({
            name: deck.name,
            ...(references.length ? { vsReference: average(index, (other) => other.reference) } : {}),
            ...(tested.length > 1 ? { vsOthers: average(index, (other) => !other.reference) } : {}),
        }))
        .sort((x, y) => ((y.vsReference ?? y.vsOthers)?.rate ?? 0) - ((x.vsReference ?? x.vsOthers)?.rate ?? 0) || x.name.localeCompare(y.name));
    const rows = matchups.map((matchup): MatchupRow => {
        const r = matchupRecord(matchup, jobs, matchup.a);
        const againstReference = decks[matchup.b].reference;
        return {
            first: decks[matchup.a].name,
            second: decks[matchup.b].name,
            againstReference,
            record: rate(r.wins, r.decided),
            play: rate(r.play.wins, r.play.games),
            draw: rate(r.draw.wins, r.draw.games),
            undecided: matchup.games.length - r.decided,
        };
    });
    const all = matchups.flatMap((matchup) => matchup.games);
    const errors = new Map<string, number>();
    for (const game of all) if (game.error) errors.set(game.error, (errors.get(game.error) ?? 0) + 1);
    return {
        rankings,
        references: references.map(({ deck, index }) => ({ name: deck.name, record: average(index, (other) => !other.reference) })),
        matchups: rows,
        games: all.length,
        unfinished: all.filter((game) => game.reason === "Turn Limit").length,
        errors: [...errors].map(([message, count]) => ({ message, count })),
    };
}
