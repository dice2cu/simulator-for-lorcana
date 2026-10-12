// Saved decks in IndexedDB. Each browser keeps its own decks; nothing leaves the device.

export interface SavedDeck {
    readonly id: string;
    readonly name: string;
    readonly text: string;
    /** Milliseconds since 1970, for sorting. */
    readonly updated: number;
}

const DATABASE = "lorcana-simulator";
const STORE = "decks";

/** Opaque local ID. getRandomValues also works on HTTP pages, unlike randomUUID. */
export function createDeckId(): string {
    return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DATABASE, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const database = await open();
    try {
        return await new Promise<T>((resolve, reject) => {
            const transaction = database.transaction(STORE, mode);
            const request = action(transaction.objectStore(STORE));
            transaction.oncomplete = () => resolve(request.result);
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error);
        });
    } finally {
        database.close();
    }
}

/** Saved decks, most recently changed first. */
export async function listDecks(): Promise<SavedDeck[]> {
    const decks = await run("readonly", (store) => store.getAll() as IDBRequest<SavedDeck[]>);
    return decks.sort((a, b) => b.updated - a.updated);
}

export async function saveDeck(deck: SavedDeck): Promise<void> {
    await run("readwrite", (store) => store.put(deck));
}

export async function deleteDeck(id: string): Promise<void> {
    await run("readwrite", (store) => store.delete(id));
}
