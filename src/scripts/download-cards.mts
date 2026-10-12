/**
 * Downloads the LorcanaJSON catalog to temp/allCards.json.
 *
 *   npm run download:cards              # skip the download if the server copy is unchanged
 *   npm run download:cards -- --force   # always download
 *
 * The file's modification time is set to the server's Last-Modified date, so
 * the next run can ask the server whether anything changed.
 */
import { mkdir, rename, stat, utimes, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { parseArgs } from "node:util";

const source = "https://lorcanajson.org/files/current/en/allCards.json";
const destination = resolve(import.meta.dirname, "../../temp/allCards.json");
const timeout = 60_000;

interface Catalog {
    metadata?: { formatVersion?: string; generatedOn?: string };
    cards: unknown[];
}

function isCatalog(value: unknown): value is Catalog {
    return typeof value === "object" && value !== null && "cards" in value && Array.isArray(value.cards);
}

async function modified(path: string): Promise<Date | undefined> {
    try {
        return (await stat(path)).mtime;
    } catch {
        return undefined;
    }
}

const { values: options } = parseArgs({ options: { force: { type: "boolean", default: false } } });
const shown = relative(process.cwd(), destination);
const existing = options.force ? undefined : await modified(destination);

try {
    const response = await fetch(source, {
        headers: existing ? { "If-Modified-Since": existing.toUTCString() } : {},
        signal: AbortSignal.timeout(timeout),
    });
    if (response.status === 304) {
        console.log(`${shown} is already current (server copy last modified ${existing?.toISOString()}).`);
    } else {
        if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText} from ${source}`);
        const text = await response.text();
        const catalog: unknown = JSON.parse(text);
        if (!isCatalog(catalog)) throw new Error("The downloaded file does not contain a cards array");

        // Write beside the destination and rename, so a failed download never leaves a partial file.
        await mkdir(dirname(destination), { recursive: true });
        const temporary = `${destination}.tmp`;
        await writeFile(temporary, text);
        const lastModified = response.headers.get("Last-Modified");
        if (lastModified) await utimes(temporary, new Date(), new Date(lastModified));
        await rename(temporary, destination);

        const { formatVersion, generatedOn } = catalog.metadata ?? {};
        const size = (Buffer.byteLength(text) / 1024 / 1024).toFixed(1);
        console.log(`Downloaded ${catalog.cards.length} printings (${size} MiB) to ${shown}.`);
        if (generatedOn) console.log(`Catalog generated ${generatedOn}, format ${formatVersion ?? "unknown"}.`);
    }
} catch (error) {
    const reason = error instanceof DOMException && error.name === "TimeoutError"
        ? `no response within ${timeout / 1000} seconds`
        : error instanceof Error ? error.message : String(error);
    console.error(`Card download failed: ${reason}`);
    process.exitCode = 1;
}
