import { useState } from "react";
import { DecksTab } from "./decks/decks-tab";
import { useDecks } from "./decks/use-decks";
import { SimulateTab } from "./simulate/simulate-tab";

const TABS = ["Simulate", "Decks"] as const;
type Tab = (typeof TABS)[number];

export function App() {
    const decks = useDecks();
    const [tab, setTab] = useState<Tab>("Simulate");
    return (
        <>
            <header className="app-header">
                <div className="container page">
                    <h1 className="brand">
                        <img className="brand-mark" src="logo.svg" alt="" width="28" height="28" />
                        Simulator for Lorcana
                    </h1>
                    <nav className="nav nav-fill app-tabs" aria-label="Main navigation">
                        {TABS.map((name) => (
                            <button
                                key={name}
                                className={`nav-link ${tab === name ? "active" : ""}`}
                                aria-current={tab === name ? "page" : undefined}
                                onClick={() => setTab(name)}
                            >
                                {name}
                            </button>
                        ))}
                    </nav>
                </div>
            </header>
            <main className="container page">
                {/* Tabs stay mounted, so a running simulation survives switching. */}
                <div hidden={tab !== "Decks"}>
                    <DecksTab decks={decks} />
                </div>
                <div hidden={tab !== "Simulate"}>
                    <SimulateTab decks={decks} />
                </div>
            </main>
        </>
    );
}
