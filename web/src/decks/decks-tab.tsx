import { useMemo, useRef, useState } from "react";
import { CardText, Inks, inkClass } from "../cards/card-view";
import { checkDeck, deckCards, deckInks, type DeckSummary } from "./library";
import type { Decks } from "./use-decks";
import { DeckInput } from "./deck-input";

interface Draft {
    /** The saved deck being edited, if any. */
    readonly id?: string;
    readonly name: string;
    readonly text: string;
    /** Reference decks can be read, not changed. */
    readonly reference: boolean;
}

const EMPTY: Draft = { name: "New deck", text: "", reference: false };

/** The deck list, or one deck at a time. */
export function DecksTab({ decks }: { decks: Decks }) {
    const [draft, setDraft] = useState<Draft>();
    return draft ? (
        <DeckEditor decks={decks} initial={draft} onClose={() => setDraft(undefined)} />
    ) : (
        <>
            <div className="section-title">Your decks</div>
            <DeckList decks={decks.saved} onOpen={setDraft} />
            <button className="deck-new mb-2" onClick={() => setDraft(EMPTY)}>
                <span aria-hidden>＋</span> New deck
            </button>
            <div className="section-title">Reference decks</div>
            <DeckList decks={decks.reference} onOpen={setDraft} />
            {decks.error && <div className="alert alert-warning small mt-3">{decks.error}</div>}
        </>
    );
}

function DeckEditor({ decks, initial, onClose }: { decks: Decks; initial: Draft; onClose(): void }) {
    const [draft, setDraft] = useState(initial);
    const [saved, setSaved] = useState({ name: initial.name, text: initial.text });
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string>();
    const busy = useRef(false);
    const check = useMemo(() => checkDeck(draft.text), [draft.text]);
    const changed = !draft.reference && (draft.name !== saved.name || draft.text !== saved.text);
    const inks = deckInks(check.cards);

    const close = (): void => {
        if (!changed || confirm("Discard unsaved changes?")) onClose();
    };
    const save = async (): Promise<void> => {
        if (busy.current) return;
        busy.current = true;
        setPending(true);
        setError(undefined);
        const name = draft.name.trim() || "Unnamed deck";
        try {
            const id = await decks.save({ id: draft.id, name, text: draft.text });
            setDraft((current) => ({ ...current, id, name: current.name === draft.name ? name : current.name }));
            setSaved({ name, text: draft.text });
        } catch (cause) {
            setError(`Could not save the deck: ${String(cause)}`);
        } finally {
            busy.current = false;
            setPending(false);
        }
    };
    const remove = async (): Promise<void> => {
        if (busy.current || !draft.id || !confirm(`Delete ${draft.name}?`)) return;
        busy.current = true;
        setPending(true);
        setError(undefined);
        try {
            await decks.remove(draft.id);
            onClose();
        } catch (cause) {
            setError(`Could not delete the deck: ${String(cause)}`);
        } finally {
            busy.current = false;
            setPending(false);
        }
    };

    return (
        <>
            <div className="d-flex align-items-center gap-2 mb-3">
                <button className="btn btn-outline-secondary btn-icon" disabled={pending} onClick={close} aria-label="Back to decks">
                    ‹
                </button>
                <input
                    className="form-control deck-name"
                    value={draft.name}
                    readOnly={draft.reference}
                    onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                    aria-label="Deck name"
                />
                {!draft.reference && (
                    <button className="btn btn-primary" onClick={() => void save()} disabled={pending || (!changed && !!draft.id)}>
                        Save
                    </button>
                )}
            </div>
            {error && (
                <div className="alert alert-danger" role="alert">
                    {error}
                </div>
            )}
            <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
                {inks.length > 0 && <Inks inks={inks} />}
                {draft.reference && <span className="chip">Reference</span>}
                {changed && <span className="chip warn">Unsaved</span>}
            </div>
            <DeckInput text={draft.text} check={check} readOnly={draft.reference} disabled={pending} onChange={(text) => setDraft({ ...draft, text })} />
            <details className="deck-preview">
                <summary>Deck preview and cost curve</summary>
                <CardList deck={check.cards} />
            </details>
            {draft.id && (
                <button className="btn btn-sm btn-link link-danger px-0 mt-3" disabled={pending} onClick={() => void remove()}>
                    Delete deck
                </button>
            )}
        </>
    );
}

/** All printed details, sorted by cost, with one compact entry per distinct card. */
function CardList({ deck }: { deck: ReturnType<typeof checkDeck>["cards"] }) {
    const sorted = deckCards(deck).sort((a, b) => a.card.cost - b.card.cost || a.card.fullName.localeCompare(b.card.fullName));
    if (!sorted.length) return <p className="text-body-secondary">Enter a deck list above to preview its cards.</p>;
    return (
        <>
            <CostCurve cards={sorted} />
            <div className="deck-card-list mb-3">
                {sorted.map(({ card, count }) => (
                    <article key={card.fullName} className={`deck-card ${inkClass(card)}`}>
                        <h3>
                            <span className="deck-card-count">{count}×</span> {card.fullName}
                        </h3>
                        <div className="deck-card-properties">
                            <span>{[card.type, ...card.subtypes].join(" · ")}</span>
                            <span>{card.colors.join(" / ") || "Inkless"}</span>
                            <span>Cost {card.cost}</span>
                            <span>{card.inkwell ? "Inkable" : "Not inkable"}</span>
                            {card.type === "Character" && <span>Strength {card.strength}</span>}
                            {(card.type === "Character" || card.type === "Location") && (
                                <>
                                    <span>Willpower {card.willpower}</span>
                                    <span>Lore {card.lore}</span>
                                </>
                            )}
                            {card.type === "Location" && <span>Move cost {card.moveCost}</span>}
                        </div>
                        <div className="deck-card-rules">
                            <CardText text={card.fullText} />
                        </div>
                    </article>
                ))}
            </div>
        </>
    );
}

/** How many cards cost 1, 2, … 7 or more, with the card types underneath. */
function CostCurve({ cards }: { cards: ReturnType<typeof deckCards> }) {
    const counts = Array<number>(8).fill(0);
    const types = new Map<string, number>();
    for (const { card, count } of cards) {
        counts[Math.min(Math.max(card.cost, 0), 7)] += count;
        types.set(card.type, (types.get(card.type) ?? 0) + count);
    }
    const peak = Math.max(...counts, 1);
    return (
        <div className="card card-body mb-3">
            <div className="cost-curve">
                {counts.map((count, cost) => (
                    <div key={cost} className="bar">
                        <span className="count">{count || ""}</span>
                        <div className="fill" style={{ height: `${(70 * count) / peak}%` }} />
                        <span>{cost === 7 ? "7+" : cost}</span>
                    </div>
                ))}
            </div>
            <div className="d-flex flex-wrap gap-1 mt-3">
                {[...types].map(([type, count]) => (
                    <span key={type} className="chip">
                        {count} {type}
                        {count === 1 ? "" : "s"}
                    </span>
                ))}
            </div>
        </div>
    );
}

function DeckList(props: { decks: readonly DeckSummary[]; onOpen(deck: Draft): void }) {
    if (!props.decks.length) return <p className="small text-body-secondary">No saved decks yet.</p>;
    return (
        <div className="list-group mb-2">
            {props.decks.map((deck) => {
                const check = deck.check;
                return (
                    <button
                        key={deck.id}
                        className="list-group-item list-group-item-action deck-row"
                        onClick={() => props.onOpen({ id: deck.reference ? undefined : deck.id, name: deck.name, text: deck.text, reference: deck.reference })}
                    >
                        <Inks inks={deck.inks} />
                        <span className="name">{deck.name}</span>
                        {check.problems.length > 0 && <span className="chip bad">Problems</span>}
                        <span className="chevron" aria-hidden>
                            ›
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
