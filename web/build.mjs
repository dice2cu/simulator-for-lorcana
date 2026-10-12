// Builds the static site into dist/. With --serve, rebuilds on change and serves it locally.
import * as esbuild from "esbuild";
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const serve = process.argv.includes("--serve");
const out = "dist";
const referenceFolder = resolve("../reference-decks");

/** `import decks from "virtual:reference-decks"` embeds the reference deck files as { name, text } entries. */
const referenceDecks = {
    name: "reference-decks",
    setup(build) {
        build.onResolve({ filter: /^virtual:reference-decks$/ }, () => ({ path: "reference-decks", namespace: "reference-decks" }));
        build.onLoad({ filter: /.*/, namespace: "reference-decks" }, () => {
            const files = readdirSync(referenceFolder)
                .filter((name) => name.endsWith(".deck"))
                .sort();
            const decks = files.map((name) => ({ name: basename(name, ".deck"), text: readFileSync(join(referenceFolder, name), "utf8") }));
            return { contents: JSON.stringify(decks), loader: "json", watchFiles: files.map((name) => join(referenceFolder, name)), watchDirs: [referenceFolder] };
        });
    },
};

// A production build must not publish source maps or other files from an earlier build.
if (!serve) rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
copyFileSync("index.html", join(out, "index.html"));
copyFileSync("styles.css", join(out, "styles.css"));
copyFileSync("logo.svg", join(out, "logo.svg"));
copyFileSync("node_modules/bootstrap/dist/css/bootstrap.min.css", join(out, "bootstrap.min.css"));

const options = {
    entryPoints: { app: "src/main.tsx", "sim-worker": "src/simulate/sim-worker.ts", "game-worker": "src/play/game-worker.ts" },
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    outdir: out,
    minify: !serve,
    sourcemap: serve,
    jsx: "automatic",
    plugins: [referenceDecks],
    logLevel: "info",
};

if (serve) {
    const context = await esbuild.context(options);
    await context.watch();
    const { hosts, port } = await context.serve({ servedir: out });
    console.log(`Serving on http://${hosts[0] === "0.0.0.0" ? "localhost" : hosts[0]}:${port}/`);
} else {
    await esbuild.build(options);
}
