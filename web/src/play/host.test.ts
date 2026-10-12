import { describe, expect, it } from "vitest";
import { referenceDecks } from "../../../src/tests/fixtures/reference-decks";
import type { PlayerAnswer, PlayerRequest } from "../simulator";
import { hostGame } from "./host";
import type { GameMessage, GameSetup } from "./protocol";

const deck = (name: string) => referenceDecks.find((candidate) => candidate.name === name)!.cards;
const decide = (answer: Extract<PlayerAnswer, { type: "Decision" }>["answer"]): PlayerAnswer => ({ type: "Decision", answer });

/** A simple human: inks, quests and plays when it can, and takes the first legal choice otherwise. */
function scripted(request: PlayerRequest): PlayerAnswer {
    switch (request.type) {
        case "Action": {
            const preferred = ["Alter Hand", "Ink", "Quest", "Play", "End Turn"];
            const option = preferred.map((type) => request.actions.find((candidate) => candidate.action.type === type)).find(Boolean) ?? request.actions[0];
            return { type: "Action", option: option.option };
        }
        case "Choose Cards": {
            const first = request.required?.[0];
            const rest = request.cards.filter((card) => card !== first);
            return decide({ type: "Choose Cards", cards: [...(first ? [first] : []), ...rest].slice(0, request.min) });
        }
        case "Order Cards":
            return decide({ type: "Order Cards", cards: request.cards });
        case "Choose Player":
            return decide({ type: "Choose Player", player: request.players[0] });
        case "Choose Mode":
            return decide({ type: "Choose Mode", mode: request.options[0].mode });
        case "Choose Amount":
            return decide({ type: "Choose Amount", amount: request.min });
        case "Choose Trigger":
        case "Choose Replacement":
            return decide({ type: request.type, option: request.options[0].option });
        case "Pay Cost":
            return decide(request.payments.length ? { type: "Pay Cost", pay: true, payment: request.payments[0] } : { type: "Pay Cost", pay: false });
        case "Optional":
        case "Optional Cost Rule":
            return decide({ type: request.type, accept: false });
        case "Name Card":
            return decide({ type: "Name Card", name: "Lady" });
        case "Distribute Damage Removal":
            return decide({ type: "Distribute Damage Removal", amounts: request.cards.map((entry) => ({ card: entry.card, amount: 0 })) });
    }
}

describe("games in the page", () => {
    it("plays a whole game between a person and a bot, showing the person only their own seat", async () => {
        const setup: GameSetup = {
            seats: [
                { name: "Aggro", deck: deck("Amber-Steel-Aggro"), controller: "Human" },
                { name: "Pawpsicle", deck: deck("Ruby-Sapphire-Pawpsicle"), controller: "Bot" },
            ],
            first: 1,
            seed: 11,
            nodes: 0,
            botDelay: 0,
        };
        const messages: GameMessage[] = [];
        let pending: PlayerRequest | undefined;
        await hostGame(
            setup,
            (message) => {
                messages.push(message);
                if (message.type === "request") pending = message.request;
            },
            async () => scripted(pending!),
        );
        const end = messages.at(-1)!;
        expect(end.type === "end" && end.error).toBeFalsy();
        expect(end.type === "end" && end.outcome?.winners.length).toBe(1);
        expect(messages.every((message) => message.type === "end" || message.player === 1)).toBe(true);
        // Every answer was accepted the first time.
        expect(messages.some((message) => message.type === "request" && message.error)).toBe(false);
        // The opponent's hand stays hidden from the person.
        for (const message of messages) if (message.type === "update") expect(typeof message.update.state.players[2]?.hand === "number" || (message.update.state.players[2]?.hand as unknown[]).every((card) => card === null)).toBe(true);
    }, 60000);

    it("waits between bot actions when asked to", async () => {
        const pauses: number[] = [];
        const setup: GameSetup = {
            seats: [
                { name: "A", deck: deck("Amber-Steel-Aggro"), controller: "Bot" },
                { name: "B", deck: deck("Amber-Steel-Aggro"), controller: "Bot" },
            ],
            first: 2,
            seed: 5,
            nodes: 0,
            botDelay: 250,
        };
        const messages: GameMessage[] = [];
        await hostGame(setup, (message) => messages.push(message), () => Promise.reject(new Error("No person is playing")), async (milliseconds) => void pauses.push(milliseconds));
        expect(messages).toHaveLength(1);
        expect(messages[0].type === "end" && messages[0].outcome?.winners.length).toBe(1);
        expect(pauses.length).toBeGreaterThan(10);
        expect(new Set(pauses)).toEqual(new Set([250]));
    }, 60000);
});
