// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { referenceDecks } from "../../src/tests/fixtures/reference-decks";
import { DecksTab } from "./decks/decks-tab";
import { DeckInput } from "./decks/deck-input";
import { summarizeDeck, type DeckEntry } from "./decks/library";
import { useDecks, type Decks } from "./decks/use-decks";
import { Decision } from "./play/decision";
import { PlayTab } from "./play/play-tab";
import { SimulateTab } from "./simulate/simulate-tab";
import * as simulationPool from "./simulate/pool";
import { App } from "./app";
import { CopyButton } from "./copy-button";
import { cardParagraphs } from "./cards/card-view";
import type { GameMessage } from "./play/protocol";
import { getCard, type GameResult, type GameStateView, type PlayerAnswer, type PlayerRequest } from "./simulator";

vi.mock("./decks/use-decks", () => ({ useDecks: vi.fn() }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined;
let container: HTMLDivElement;
async function render(node: ReactNode): Promise<void> {
    if (!root) {
        container = document.createElement("div");
        document.body.append(container);
        root = createRoot(container);
    }
    await act(async () => root?.render(node));
}
function button(text: string): HTMLButtonElement {
    const found = [...container.querySelectorAll("button")].find((entry) => (entry.getAttribute("aria-label") ?? entry.textContent?.trim()) === text);
    if (!found) throw new Error(`Missing button: ${text}`);
    return found;
}
async function click(element: Element): Promise<void> {
    await act(async () => element.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}
async function enterDeck(text: string): Promise<void> {
    const field = container.querySelector("textarea");
    const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    if (!field || !set) throw new Error("Missing deck input");
    await act(async () => {
        set.call(field, text);
        field.dispatchEvent(new Event("input", { bubbles: true }));
    });
}
afterEach(async () => {
    await act(async () => root?.unmount());
    root = undefined;
    container?.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
});

function deck(index: number): DeckEntry {
    const entry = referenceDecks[index];
    if (!entry) throw new Error("Missing reference deck");
    return { id: `deck-${index}`, name: entry.name, text: entry.cards.map((card) => `${card.count} ${card.fullName}`).join("\n"), reference: false };
}
function decks(entries = [deck(0)]): Decks {
    const summaries = entries.map(summarizeDeck);
    return { all: summaries, saved: summaries, reference: [], save: vi.fn(async () => "saved"), remove: vi.fn(async () => {}) };
}

class WorkerStub {
    static instances: WorkerStub[] = [];
    messages: unknown[] = [];
    onmessage?: (event: { data: GameMessage }) => void;
    onerror?: (event: { message: string }) => void;
    terminate = vi.fn();
    constructor() {
        WorkerStub.instances.push(this);
    }
    postMessage(message: unknown): void {
        this.messages.push(message);
    }
    receive(message: GameMessage): void {
        this.onmessage?.({ data: message });
    }
}

describe("interactive UI", () => {
    it.each([true, false])("copies a report without the Clipboard API (success: %s)", async (success) => {
        vi.stubGlobal("navigator", {});
        const execCommand = vi.fn(() => {
            const field = document.activeElement;
            expect(field).toBeInstanceOf(HTMLTextAreaElement);
            if (!(field instanceof HTMLTextAreaElement)) throw new Error("Missing clipboard field");
            expect(field.value).toBe("# Simulation report\n\nResults");
            expect(field.selectionEnd).toBe(field.value.length);
            return success;
        });
        Object.defineProperty(document, "execCommand", { configurable: true, value: execCommand });
        try {
            await render(<CopyButton text={"# Simulation report\n\nResults"} label="Copy simulation report" />);
            const copy = button("Copy simulation report");
            copy.focus();
            await click(copy);
            expect(execCommand).toHaveBeenCalledWith("copy");
            expect(document.activeElement).toBe(copy);
            expect(document.querySelector("textarea")).toBeNull();
            expect(container.textContent).toContain(success ? "Copied to clipboard." : "Could not copy.");
        } finally {
            Reflect.deleteProperty(document, "execCommand");
        }
    });

    it("reports clipboard rejection and clears feedback when report text changes", async () => {
        vi.stubGlobal("navigator", {
            clipboard: {
                writeText: vi.fn(async () => {
                    throw new Error("Denied");
                }),
            },
        });
        await render(<CopyButton text="First report" label="Copy simulation report" />);
        await click(button("Copy simulation report"));
        expect(container.textContent).toContain("Could not copy.");
        await render(<CopyButton text="Next report" label="Copy simulation report" />);
        expect(container.textContent).not.toContain("Could not copy.");
    });

    it.each(["completion", "cancellation", "failure", "unmount"])("batches progress updates and clears pending updates on %s", async (ending) => {
        vi.useFakeTimers();
        const setup = decks();
        const reference = summarizeDeck({ ...deck(1), reference: true });
        let deliver = (_count: number): void => {
            throw new Error("Pool not started");
        };
        let complete: ((error?: Error) => void) | undefined;
        let cancel = (): void => {
            throw new Error("Pool not started");
        };
        vi.spyOn(simulationPool, "runPool").mockImplementation((_decks, jobs, _workers, _createWorker, onResult) => {
            const results = jobs.map((job): GameResult => ({
                id: job.id,
                winner: 0,
                reason: "Lore",
                turns: 10,
                lore: [20, 5],
                decisions: 0,
                deciding: 0,
                worlds: 0,
                replayed: 0,
                played: [[], []],
                inked: [[], []],
            }));
            let next = 0;
            deliver = (count) => {
                for (let i = 0; i < count; i++) onResult(results[next++]);
            };
            return {
                cancel: () => cancel(),
                done: new Promise<GameResult[]>((resolve, reject) => {
                    complete = (error) => (error ? reject(error) : resolve(results.slice(0, next)));
                    cancel = () => resolve(results.slice(0, next));
                }),
            };
        });
        await render(<SimulateTab decks={{ ...setup, all: [...setup.all, reference], reference: [reference] }} />);
        const runButton = [...container.querySelectorAll("button")].find((entry) => entry.textContent?.startsWith("Run "));
        if (!runButton) throw new Error("Missing run button");
        await click(runButton);
        expect(container.querySelector('[aria-label="Copy simulation report"]')).toBeNull();
        await act(async () => deliver(2));
        expect(container.querySelector('[role="progressbar"]')?.getAttribute("aria-valuenow")).toBe("0");
        await act(async () => vi.advanceTimersByTime(249));
        expect(container.querySelector('[role="progressbar"]')?.getAttribute("aria-valuenow")).toBe("0");
        await act(async () => vi.advanceTimersByTime(1));
        expect(container.querySelector('[role="progressbar"]')?.getAttribute("aria-valuenow")).toBe("2");
        await act(async () => {
            deliver(1);
            if (!complete) throw new Error("Pool not started");
            if (ending === "completion") complete();
            if (ending === "failure") complete(new Error("Worker crashed"));
        });
        if (ending === "cancellation") await click(button("Cancel"));
        if (ending === "unmount") {
            await render(<div />);
            expect(vi.getTimerCount()).toBe(0);
            return;
        }
        expect(container.querySelector('[role="progressbar"]')?.getAttribute("aria-valuenow")).toBe("3");
        expect(container.textContent).not.toContain("Cancel");
        if (ending === "cancellation") expect(container.textContent).toContain("cancelled");
        if (ending === "failure") expect(container.textContent).toContain("Worker crashed");
        const writeText = vi.fn(async () => {});
        vi.stubGlobal("navigator", { clipboard: { writeText } });
        expect(button("Copy simulation report").querySelector("svg")).not.toBeNull();
        await click(button("Copy simulation report"));
        const copied = String(writeText.mock.lastCall?.at(0) ?? "");
        expect(copied).toContain("# Simulation report");
        expect(copied).toContain("## Deck rankings");
        expect(copied).toContain("## Matchups");
        expect(copied).toContain("3 games");
        if (ending !== "completion") expect(copied).toContain("Partial results follow.");
        expect(container.textContent).toContain("Copied to clipboard.");
        expect(vi.getTimerCount()).toBe(0);
    });

    it("shows worker startup failures and allows another run", async () => {
        vi.stubGlobal(
            "Worker",
            class {
                constructor() {
                    throw new Error("Workers unavailable");
                }
            },
        );
        const setup = decks();
        const reference = summarizeDeck({ ...deck(1), reference: true });
        await render(<SimulateTab decks={{ ...setup, all: [...setup.all, reference], reference: [reference] }} />);
        const runButton = [...container.querySelectorAll("button")].find((entry) => entry.textContent?.startsWith("Run "));
        if (!runButton) throw new Error("Missing run button");
        await click(runButton);
        expect(container.querySelector('[role="progressbar"]')?.getAttribute("aria-valuenow")).toBe("0");
        expect(container.textContent).toContain("Workers unavailable");
        expect(container.textContent).not.toContain("Cancel");
        expect(runButton.disabled).toBe(false);
    });

    it("copies the exact deck text and confirms success", async () => {
        const writeText = vi.fn(async () => {});
        vi.stubGlobal("navigator", { clipboard: { writeText } });
        const saved = summarizeDeck(deck(0));
        await render(<DeckInput text={saved.text} check={saved.check} readOnly onChange={vi.fn()} />);
        expect(button("Copy deck text").querySelector("svg")).not.toBeNull();
        expect(button("Copy deck text").title).toBe("Copy deck text");
        await click(button("Copy deck text"));
        expect(writeText).toHaveBeenCalledWith(saved.text);
        expect(container.textContent).toContain("Copied to clipboard.");
        await render(<DeckInput text={deck(1).text} check={summarizeDeck(deck(1)).check} readOnly onChange={vi.fn()} />);
        expect(container.textContent).not.toContain("Copied to clipboard.");
    });

    it("reports clipboard failures without changing the deck", async () => {
        vi.stubGlobal("navigator", {
            clipboard: {
                writeText: vi.fn(async () => {
                    throw new Error("Denied");
                }),
            },
        });
        await render(<SimulateTab decks={decks()} />);
        await click(button("Copy deck text"));
        expect(container.textContent).toContain("Could not copy.");
        expect(container.querySelector("textarea")?.value).toBe(deck(0).text);
    });

    it("copies on HTTP pages without the Clipboard API", async () => {
        vi.stubGlobal("navigator", {});
        const execCommand = vi.fn(() => {
            const field = document.activeElement;
            if (!(field instanceof HTMLTextAreaElement)) throw new Error("Missing clipboard field");
            expect(field.value).toBe(deck(0).text);
            expect(field.selectionStart).toBe(0);
            expect(field.selectionEnd).toBe(field.value.length);
            return true;
        });
        Object.defineProperty(document, "execCommand", { configurable: true, value: execCommand });
        try {
            await render(<SimulateTab decks={decks()} />);
            await click(button("Copy deck text"));
            expect(execCommand).toHaveBeenCalledWith("copy");
            const field = container.querySelector("textarea");
            expect(field?.value).toBe(deck(0).text);
            expect(document.querySelectorAll("textarea")).toHaveLength(1);
            expect(container.textContent).toContain("Copied to clipboard.");
        } finally {
            Reflect.deleteProperty(document, "execCommand");
        }
    });

    it("disables deck copying when the input is disabled or empty", async () => {
        const saved = summarizeDeck(deck(0));
        await render(<DeckInput text={saved.text} check={saved.check} disabled onChange={vi.fn()} />);
        expect(button("Copy deck text").disabled).toBe(true);
        await render(<DeckInput text=" " check={saved.check} onChange={vi.fn()} />);
        expect(button("Copy deck text").disabled).toBe(true);
        await render(<DeckInput text={saved.text} check={saved.check} onChange={vi.fn()} />);
        expect(button("Copy deck text").disabled).toBe(false);
    });

    it("opens Simulate with a simple title and the first saved deck", async () => {
        vi.mocked(useDecks).mockReturnValue(decks());
        await render(<App />);
        expect(container.querySelector("h1")?.textContent).toBe("Simulator for Lorcana");
        expect(container.querySelector('[aria-current="page"]')?.textContent).toBe("Simulate");
        expect([...container.querySelectorAll("nav button")].map((button) => button.textContent)).toEqual(["Simulate", "Decks"]);
        expect(container.textContent).not.toContain("Play a game");
        const field = container.querySelector<HTMLTextAreaElement>("textarea");
        expect(field?.closest("[hidden]")).toBeNull();
        expect(field?.value).toBe(deck(0).text);
    });

    it("loads saved decks arriving later, without replacing a typed deck", async () => {
        await render(<SimulateTab decks={decks([])} />);
        await render(<SimulateTab decks={decks()} />);
        expect(container.querySelector("textarea")?.value).toBe(deck(0).text);
        await enterDeck(deck(2).text);
        await render(<SimulateTab decks={decks([deck(1), deck(0)])} />);
        expect(container.querySelector("textarea")?.value).toBe(deck(2).text);
    });

    it("shows wins against reference decks as ordinary results, not warnings", async () => {
        const setup = decks();
        const reference = summarizeDeck({ ...deck(1), reference: true });
        vi.spyOn(simulationPool, "runPool").mockImplementation((_decks, jobs, _workers, _createWorker, onResult) => ({
            cancel: vi.fn(),
            done: Promise.resolve().then(() => {
                const results = jobs.map((job): GameResult => ({
                    id: job.id,
                    winner: job.decks[0] === 0 ? 0 : 1,
                    reason: "Lore",
                    turns: 10,
                    lore: job.decks[0] === 0 ? [20, 5] : [5, 20],
                    decisions: 0,
                    deciding: 0,
                    worlds: 0,
                    replayed: 0,
                    played: [[], []],
                    inked: [[], []],
                }));
                for (const result of results) onResult(result);
                return results;
            }),
        }));
        await render(<SimulateTab decks={{ ...setup, all: [...setup.all, reference], reference: [reference] }} />);
        await click(button("Run 20 games"));
        expect(container.querySelector("tbody")?.textContent).toContain("100%");
        expect(container.querySelector(".alert-warning, .table-warning")).toBeNull();
        expect(container.textContent).not.toContain("engine or bot mistake");
    });

    it("does not replace a new list typed before saved decks load", async () => {
        await render(<SimulateTab decks={decks([])} />);
        await enterDeck(deck(2).text);
        await render(<SimulateTab decks={decks()} />);
        expect(container.querySelector("textarea")?.value).toBe(deck(2).text);
        expect(container.querySelector<HTMLSelectElement>("#simulation-deck")?.value).toBe("");
    });

    it("simulates an entered deck without saving it, and blocks invalid input", async () => {
        WorkerStub.instances = [];
        vi.stubGlobal("Worker", WorkerStub);
        const setup = decks([]);
        const opponent = summarizeDeck({ ...deck(1), reference: true });
        await render(<SimulateTab decks={{ ...setup, all: [opponent], reference: [opponent] }} />);
        await enterDeck("4 Unknown Card");
        expect(button("Run 0 games").disabled).toBe(true);
        expect(container.querySelector('[role="status"]')?.textContent).toContain("Unknown");
        await enterDeck(deck(0).text);
        await click(button("Run 20 games"));
        const messages = WorkerStub.instances[0]?.messages as { type: string; decks?: { cards: unknown }[] }[];
        expect(messages.find((message) => message.type === "decks")?.decks?.[0]?.cards).toEqual(summarizeDeck(deck(0)).check.cards);
        expect(setup.save).not.toHaveBeenCalled();
        expect(container.querySelector("textarea")?.disabled).toBe(true);
    });

    it("keeps the saved deck unchanged when editing its simulation copy", async () => {
        const setup = decks();
        await render(<SimulateTab decks={setup} />);
        await enterDeck(deck(2).text);
        expect(setup.saved[0]?.text).toBe(deck(0).text);
        expect(setup.save).not.toHaveBeenCalled();
        expect(container.textContent).toContain("Changes apply to this simulation only");
    });

    it("loads a selected saved deck and clears the previous simulation-only edit", async () => {
        await render(<SimulateTab decks={decks([deck(0), deck(1)])} />);
        await enterDeck(deck(2).text);
        const select = container.querySelector<HTMLSelectElement>("#simulation-deck");
        if (!select) throw new Error("Missing deck selector");
        await act(async () => {
            select.value = deck(1).id;
            select.dispatchEvent(new Event("change", { bubbles: true }));
        });
        expect(container.querySelector("textarea")?.value).toBe(deck(1).text);
        expect(container.textContent).not.toContain("Changes apply to this simulation only");
    });

    it("shows the deck editor directly with a clearly named preview", async () => {
        await render(<DecksTab decks={decks()} />);
        const entry = container.querySelector(".deck-row");
        if (!entry) throw new Error("Missing saved deck");
        await click(entry);
        expect(container.querySelector("textarea")?.value).toBe(deck(0).text);
        expect(container.querySelector("summary")?.textContent).toBe("Deck preview and cost curve");
        expect([...container.querySelectorAll("button")].some((entry) => entry.textContent === "Text" || entry.textContent === "Cards")).toBe(false);
        expect(container.querySelector("textarea")?.labels?.[0]?.textContent?.trim()).toBe("Cards and quantities");
    });

    it("shows every preview card's complete rules and printed properties without expanding individual cards", async () => {
        const setup = decks();
        await render(<DecksTab decks={setup} />);
        const entry = container.querySelector(".deck-row");
        if (!entry) throw new Error("Missing saved deck");
        await click(entry);
        const preview = container.querySelector<HTMLDetailsElement>(".deck-preview");
        if (!preview) throw new Error("Missing preview");
        await click(preview.querySelector("summary") ?? preview);
        const cards = [...preview.querySelectorAll("article")];
        expect(cards).toHaveLength(setup.saved[0]?.check.cards.length ?? 0);
        for (const printed of setup.saved[0]?.check.cards ?? []) {
            const card = getCard(printed.fullName);
            const row = cards.find((row) => row.querySelector("h3")?.textContent?.includes(printed.fullName));
            if (!card || !row) throw new Error(`Missing preview for ${printed.fullName}`);
            expect(row.querySelector("h3")?.textContent).toContain(`${printed.count}×`);
            expect(row.textContent).toContain(`Cost ${card.cost}`);
            expect(row.textContent).toContain(card.inkwell ? "Inkable" : "Not inkable");
            expect(row.querySelector(".deck-card-rules")?.textContent).toBe(cardParagraphs(card.fullText ?? "").join(""));
            expect(row.querySelector('[role="button"], details')).toBeNull();
            if (card.type === "Character") expect(row.textContent).toContain(`Strength ${card.strength}`);
            if (card.type === "Character" || card.type === "Location") {
                expect(row.textContent).toContain(`Willpower ${card.willpower}`);
                expect(row.textContent).toContain(`Lore ${card.lore}`);
            }
            if (card.type === "Location") expect(row.textContent).toContain(`Move cost ${card.moveCost}`);
        }
    });

    it("uses edited contents of a selected deck in the next simulation", async () => {
        WorkerStub.instances = [];
        vi.stubGlobal("Worker", WorkerStub);
        const first = deck(0),
            opponent = deck(1);
        await render(<SimulateTab decks={decks([first, opponent])} />);
        const checkboxes = container.querySelectorAll('input[type="checkbox"]');
        if (!checkboxes[0]) throw new Error("Missing additional deck checkbox");
        await click(checkboxes[0]);
        const edited = { ...first, text: deck(2).text };
        await render(<SimulateTab decks={decks([edited, opponent])} />);
        const run = [...container.querySelectorAll("button")].find((entry) => entry.textContent?.startsWith("Run "));
        if (!run) throw new Error("Missing run button");
        await click(run);
        const messages = WorkerStub.instances[0]?.messages as { type: string; decks?: { cards: unknown }[] }[];
        expect(messages.find((message) => message.type === "decks")?.decks?.[0]?.cards).toEqual(summarizeDeck(edited).check.cards);
    });

    it("shows save failures and prevents duplicate saves before a render", async () => {
        let reject: (error: Error) => void = () => {
            throw new Error("Save was not started");
        };
        const setup = decks([]);
        const save = vi.fn(
            () =>
                new Promise<string>((_, fail) => {
                    reject = fail;
                }),
        );
        await render(<DecksTab decks={{ ...setup, save }} />);
        await click(button("＋ New deck"));
        const saveButton = button("Save");
        await act(async () => {
            saveButton.click();
            saveButton.click();
        });
        expect(save).toHaveBeenCalledTimes(1);
        expect(saveButton.disabled).toBe(true);
        await act(async () => reject(new Error("Disk is full")));
        expect(container.querySelector('[role="alert"]')?.textContent).toContain("Disk is full");
        expect(button("Save").disabled).toBe(false);
    });

    it("shows delete failures without closing the editor", async () => {
        vi.stubGlobal("confirm", () => true);
        const setup = decks();
        await render(
            <DecksTab
                decks={{
                    ...setup,
                    remove: async () => {
                        throw new Error("Read only");
                    },
                }}
            />,
        );
        const entry = container.querySelector(".deck-row");
        if (!entry) throw new Error("Missing saved deck");
        await click(entry);
        await click(button("Delete deck"));
        expect(container.querySelector('[role="alert"]')?.textContent).toContain("Read only");
        expect(button("Delete deck").disabled).toBe(false);
    });

    it("distinguishes copies by board state and submits the selected physical card", async () => {
        const a = { fullName: "Mickey Mouse - True Friend", i: 1 },
            b = { ...a, i: 2 };
        const view: GameStateView = {
            turn: { number: 2, player: 1 },
            players: {
                2: {
                    lore: 0,
                    turnsTaken: 1,
                    deck: 10,
                    hand: 3,
                    inkwell: [],
                    discard: [],
                    play: [
                        { card: a, damage: 2 },
                        { card: b, exerted: true },
                    ],
                },
            },
        };
        const answer = vi.fn();
        await render(
            <Decision
                request={{ type: "Choose Cards", player: 1, cards: [a, b], min: 1, max: 1 }}
                view={view}
                characteristics={[{ card: a, strength: 7, willpower: 8, lore: 3 }]}
                onAnswer={answer}
            />,
        );
        const faces = container.querySelectorAll('[role="button"]');
        expect(faces[0]?.getAttribute("aria-label")).toContain("2 damage");
        expect(faces[1]?.getAttribute("aria-label")).toContain("exerted");
        expect(faces[0]?.querySelector('[title="Strength"]')?.textContent).toContain("7");
        if (!faces[1]) throw new Error("Missing second copy");
        await click(faces[1]);
        await click(button("Confirm (1)"));
        expect(answer).toHaveBeenCalledWith({ type: "Decision", answer: { type: "Choose Cards", cards: [b] } });
    });

    it("lets a human edit payment cards beyond the suggested payments", async () => {
        const a = { fullName: "Mickey Mouse - True Friend", i: 1 },
            b = { ...a, i: 2 };
        const answer = vi.fn();
        const request: PlayerRequest = {
            type: "Pay Cost",
            player: 1,
            cost: [],
            optional: false,
            cards: [a, b],
            ink: [],
            payments: [[{ type: "Discard", player: 1, cards: [a] }]],
        };
        await render(<Decision request={request} onAnswer={answer} />);
        await click(button("Choose payment"));
        const faces = container.querySelectorAll('[role="button"]');
        if (!faces[0] || !faces[1]) throw new Error("Missing payment choices");
        await click(faces[0]);
        await click(faces[1]);
        await click(button("Confirm payment"));
        expect(answer).toHaveBeenCalledWith({
            type: "Decision",
            answer: { type: "Pay Cost", pay: true, payment: [{ type: "Discard", player: 1, cards: [b] }] },
        });
    });

    it("lets a human select a specific hidden ink card", async () => {
        const answer = vi.fn();
        await render(
            <Decision
                request={{
                    type: "Pay Cost",
                    player: 1,
                    cost: [{ type: "Ink", amount: 1 }],
                    optional: false,
                    ink: [{ player: 1, cards: [{ hidden: 0 }, { hidden: 1 }], inkDrops: 0 }],
                    payments: [[{ type: "Ink", player: 1, cards: [{ hidden: 0 }] }]],
                }}
                onAnswer={answer}
            />,
        );
        await click(button("Choose payment"));
        const toggles = container.querySelectorAll('input[type="checkbox"]');
        if (!toggles[0] || !toggles[1]) throw new Error("Missing ink choices");
        await click(toggles[0]);
        await click(toggles[1]);
        await click(button("Confirm payment"));
        expect(answer).toHaveBeenCalledWith({
            type: "Decision",
            answer: { type: "Pay Cost", pay: true, payment: [{ type: "Ink", player: 1, cards: [{ hidden: 1 }] }] },
        });
    });

    it("enforces required cards and the total-value limit before confirming a choice", async () => {
        const a = { fullName: "Mickey Mouse - True Friend", i: 1 },
            b = { ...a, i: 2 };
        await render(
            <Decision
                request={{
                    type: "Choose Cards",
                    player: 1,
                    cards: [a, b],
                    min: 1,
                    max: 2,
                    required: [a],
                    total: {
                        max: 3,
                        values: [
                            { card: a, value: 2 },
                            { card: b, value: 2 },
                        ],
                    },
                }}
                onAnswer={vi.fn()}
            />,
        );
        const faces = container.querySelectorAll('[role="button"]');
        if (!faces[0] || !faces[1]) throw new Error("Missing card choices");
        await click(faces[1]);
        expect(button("Confirm (1)").disabled).toBe(true);
        await click(faces[0]);
        expect(button("Confirm (2)").disabled).toBe(true);
        await click(faces[1]);
        expect(button("Confirm (1)").disabled).toBe(false);
    });

    it("renders a rejected answer again, then clears controls for the next request", async () => {
        WorkerStub.instances = [];
        vi.stubGlobal("Worker", WorkerStub);
        await render(<PlayTab decks={decks([deck(0), deck(1)])} />);
        await click(button("Start game"));
        const worker = WorkerStub.instances[0];
        if (!worker) throw new Error("Missing game worker");
        const state: GameStateView = { turn: { number: 1, player: 1 }, players: {} };
        const request: PlayerRequest = { type: "Choose Amount", player: 1, min: 0, max: 2 };
        await act(async () => worker.receive({ type: "request", player: 1, state, request }));
        await click(button("Confirm"));
        expect(worker.messages.at(-1)).toEqual({
            type: "answer",
            answer: { type: "Decision", answer: { type: "Choose Amount", amount: 2 } } satisfies PlayerAnswer,
        });
        await act(async () => worker.receive({ type: "request", player: 1, state, request, error: "Try again" }));
        expect(container.textContent).toContain("Try again");
        await click(button("Confirm"));
        await act(async () => worker.receive({ type: "request", player: 1, state, request: { ...request, max: 5 } }));
        expect(container.textContent).not.toContain("Try again");
        expect(container.querySelector<HTMLInputElement>('input[type="number"]')?.value).toBe("5");
    });
});
