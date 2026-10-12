import { useCallback, useEffect, useMemo, useState } from "react";
import referenceFiles from "virtual:reference-decks";
import { summarizeDeck, type DeckSummary } from "./library";
import { createDeckId, deleteDeck, listDecks, saveDeck, type SavedDeck } from "./storage";

export const referenceDecks: readonly DeckSummary[] = referenceFiles.map((file) =>
    summarizeDeck({ id: `reference:${file.name}`, name: file.name, text: file.text, reference: true }),
);

export interface Decks {
    /** Saved decks first, most recent first, then reference decks. */
    readonly all: readonly DeckSummary[];
    readonly saved: readonly DeckSummary[];
    readonly reference: readonly DeckSummary[];
    readonly error?: string;
    save(deck: { id?: string; name: string; text: string }): Promise<string>;
    remove(id: string): Promise<void>;
}

/** The decks every tab can choose from. Saving or deleting refreshes them. */
export function useDecks(): Decks {
    const [saved, setSaved] = useState<SavedDeck[]>([]);
    const [error, setError] = useState<string>();
    const refresh = useCallback(async () => {
        try {
            setSaved(await listDecks());
            setError(undefined);
        } catch (cause) {
            setError(`Saved decks are unavailable in this browser: ${String(cause)}`);
        }
    }, []);
    useEffect(() => void refresh(), [refresh]);
    const save = useCallback(
        async (deck: { id?: string; name: string; text: string }) => {
            const id = deck.id ?? createDeckId();
            await saveDeck({ id, name: deck.name, text: deck.text, updated: Date.now() });
            await refresh();
            return id;
        },
        [refresh],
    );
    const remove = useCallback(
        async (id: string) => {
            await deleteDeck(id);
            await refresh();
        },
        [refresh],
    );
    return useMemo(() => {
        const mine = saved.map((deck) => summarizeDeck({ id: deck.id, name: deck.name, text: deck.text, reference: false }));
        return { all: [...mine, ...referenceDecks], saved: mine, reference: referenceDecks, error, save, remove };
    }, [saved, error, save, remove]);
}
