import { useState } from "react";
import {
    cards as catalog,
    getCard,
    type CardIdentifier,
    type GameStateView,
    type PlayerAnswer,
    type PlayerCard,
    type PlayerPayment,
    type PlayerRequest,
    type PlayerUpdate,
} from "../simulator";
import { cardLabel, InstanceCard } from "./card-instance";
import { actionCards, actionText, cardName, costText, effectText, paymentText } from "./describe";

interface DecisionProps<T extends PlayerRequest["type"] = PlayerRequest["type"]> {
    readonly request: Extract<PlayerRequest, { type: T }>;
    readonly focus?: CardIdentifier;
    readonly view?: GameStateView;
    readonly characteristics?: PlayerUpdate["characteristics"];
    onAnswer(answer: PlayerAnswer): void;
}

const same = (a: PlayerCard, b: PlayerCard | undefined): boolean =>
    !!b && ("hidden" in a ? "hidden" in b && a.hidden === b.hidden : !("hidden" in b) && a.fullName === b.fullName && a.i === b.i);
const decide = (answer: Extract<PlayerAnswer, { type: "Decision" }>["answer"]): PlayerAnswer => ({ type: "Decision", answer });

/** The controls for one request. Every answer is checked again by the game. */
export function Decision(props: DecisionProps) {
    const { request } = props;
    switch (request.type) {
        case "Action":
            return request.actions.every((option) => option.action.type === "Alter Hand") ? (
                <Mulligan {...props} request={request} />
            ) : (
                <Actions {...props} request={request} />
            );
        case "Choose Cards":
            return <ChooseCards {...props} request={request} key={JSON.stringify(request)} />;
        case "Order Cards":
            return <OrderCards {...props} request={request} key={JSON.stringify(request)} />;
        case "Choose Player":
            return (
                <Choices
                    title="Choose a player"
                    options={request.players.map((player) => ({ label: `Player ${player}`, answer: decide({ type: "Choose Player", player }) }))}
                    onAnswer={props.onAnswer}
                />
            );
        case "Choose Mode":
            return (
                <Choices
                    title="Choose one"
                    options={request.options.map((option) => ({
                        label: effectText(option.effect),
                        answer: decide({ type: "Choose Mode", mode: option.mode }),
                    }))}
                    onAnswer={props.onAnswer}
                />
            );
        case "Choose Trigger":
            return (
                <Choices
                    title="Choose which effect resolves next"
                    options={request.options.map((option) => ({
                        label: `${option.source ? `${option.source.card.fullName}: ` : ""}${effectText(option.effect)}`,
                        answer: decide({ type: "Choose Trigger", option: option.option }),
                    }))}
                    onAnswer={props.onAnswer}
                />
            );
        case "Choose Replacement":
            return (
                <Choices
                    title="Choose which replacement effect applies"
                    options={request.options.map((option) => ({
                        label: option.source ? `From ${option.source.card.fullName}` : `Option ${option.option + 1}`,
                        answer: decide({ type: "Choose Replacement", option: option.option }),
                    }))}
                    onAnswer={props.onAnswer}
                />
            );
        case "Optional":
            return (
                <Choices
                    title={`You may: ${effectText(request.effect)}`}
                    options={[
                        { label: "Yes", answer: decide({ type: "Optional", accept: true }) },
                        { label: "No", answer: decide({ type: "Optional", accept: false }) },
                    ]}
                    onAnswer={props.onAnswer}
                />
            );
        case "Optional Cost Rule":
            return (
                <Choices
                    title="Use the optional cost change?"
                    options={[
                        { label: "Yes", answer: decide({ type: "Optional Cost Rule", accept: true }) },
                        { label: "No", answer: decide({ type: "Optional Cost Rule", accept: false }) },
                    ]}
                    onAnswer={props.onAnswer}
                />
            );
        case "Pay Cost":
            return <PayCost {...props} request={request} key={JSON.stringify(request)} />;
        case "Choose Amount":
            return <ChooseAmount {...props} request={request} key={JSON.stringify(request)} />;
        case "Name Card":
            return <NameCard {...props} request={request} />;
        case "Distribute Damage Removal":
            return <DistributeDamage {...props} request={request} key={JSON.stringify(request)} />;
    }
}

/** Suggestions are shortcuts, not the only payments a human is allowed to make. */
function PayCost({ request, view, characteristics, onAnswer }: DecisionProps<"Pay Cost">) {
    const [editing, setEditing] = useState(false);
    const [payment, setPayment] = useState<readonly PlayerPayment[]>(request.payments[0] ?? []);
    const change = (index: number, part: PlayerPayment): void => setPayment((current) => current.map((entry, i) => (i === index ? part : entry)));
    return (
        <>
            <Choices
                title={`Pay ${costText(request.cost)}${request.optional ? "?" : ""}`}
                options={[
                    ...request.payments.map((payment) => ({ label: paymentText(payment), answer: decide({ type: "Pay Cost", pay: true, payment }) })),
                    ...(request.optional ? [{ label: "Don't pay", answer: decide({ type: "Pay Cost", pay: false }) }] : []),
                ]}
                onAnswer={onAnswer}
            />
            {request.payments.length > 0 && (
                <button className="btn btn-outline-secondary mt-2" onClick={() => setEditing(!editing)}>
                    Choose payment
                </button>
            )}
            {editing && (
                <div className="card card-body mt-2">
                    <p className="small">Choose the cards and amounts to pay. The game checks the complete payment before accepting it.</p>
                    {payment.map((part, index) => (
                        <fieldset key={index} className="mb-3">
                            <legend className="small">{part.type}</legend>
                            {"cards" in part && (
                                <CardToggles
                                    cards={
                                        part.type === "Ink"
                                            ? (request.ink.find((ink) => ink.player === part.player)?.cards ?? [])
                                            : (request.cards ?? part.cards)
                                    }
                                    chosen={part.cards}
                                    view={view}
                                    characteristics={characteristics}
                                    onChange={(cards) => change(index, { ...part, cards })}
                                />
                            )}
                            {part.type === "Ink" && (
                                <label className="small">
                                    Ink drops{" "}
                                    <input
                                        aria-label={`Ink drops ${index + 1}`}
                                        type="number"
                                        min={0}
                                        max={request.ink.find((ink) => ink.player === part.player)?.inkDrops ?? 0}
                                        value={part.inkDrops ?? 0}
                                        onChange={(event) => change(index, { ...part, inkDrops: Math.max(0, Math.floor(Number(event.target.value)) || 0) })}
                                    />
                                </label>
                            )}
                            {"amount" in part && (
                                <label className="small">
                                    Amount{" "}
                                    <input
                                        aria-label={`Amount ${index + 1}`}
                                        type="number"
                                        min={0}
                                        value={part.amount}
                                        onChange={(event) => change(index, { ...part, amount: Math.max(0, Math.floor(Number(event.target.value)) || 0) })}
                                    />
                                </label>
                            )}
                            {part.type === "Move Card" && part.to === "Under" && (
                                <label className="small">
                                    Put under{" "}
                                    <select
                                        aria-label={`Put under ${index + 1}`}
                                        value={JSON.stringify(part.under)}
                                        onChange={(event) => {
                                            const under = request.cards?.find((card) => !("hidden" in card) && JSON.stringify(card) === event.target.value);
                                            if (under && !("hidden" in under)) change(index, { ...part, under });
                                        }}
                                    >
                                        {(request.cards ?? [part.under]).flatMap((card) =>
                                            "hidden" in card
                                                ? []
                                                : [
                                                      <option key={JSON.stringify(card)} value={JSON.stringify(card)}>
                                                          {cardLabel(card, view)}
                                                      </option>,
                                                  ],
                                        )}
                                    </select>
                                </label>
                            )}
                        </fieldset>
                    ))}
                    <button className="btn btn-primary" onClick={() => onAnswer(decide({ type: "Pay Cost", pay: true, payment }))}>
                        Confirm payment
                    </button>
                </div>
            )}
        </>
    );
}

function Choices(props: { title: string; options: readonly { label: string; answer: PlayerAnswer }[]; onAnswer(answer: PlayerAnswer): void }) {
    return (
        <>
            <div className="decision-title">{props.title}</div>
            <div className="d-grid gap-1">
                {props.options.map((option, index) => (
                    <button key={index} className="btn btn-sm btn-outline-primary text-start" onClick={() => props.onAnswer(option.answer)}>
                        {option.label}
                    </button>
                ))}
            </div>
        </>
    );
}

const ORDER = ["Ink", "Play", "Shift", "Sing", "Quest", "Challenge", "Move", "Activate", "Boost", "End Turn"];

function Actions({ request, focus, view, onAnswer }: DecisionProps<"Action">) {
    const shown = focus ? request.actions.filter((option) => actionCards(option.action).some((card) => same(card, focus))) : request.actions;
    const sorted = [...shown].sort((a, b) => ORDER.indexOf(a.action.type) - ORDER.indexOf(b.action.type));
    return (
        <>
            <div className="decision-title">
                {focus ? (shown.length ? "Actions with this card" : "No actions with this card right now.") : "Choose an action"}
            </div>
            <div className="d-grid gap-1">
                {sorted.map((option) => (
                    <button
                        key={option.option}
                        className={`btn btn-sm text-start ${option.action.type === "End Turn" ? "btn-outline-secondary" : "btn-outline-primary"}`}
                        onClick={() => onAnswer({ type: "Action", option: option.option })}
                    >
                        {actionText(option.action)}
                        {view && actionCards(option.action).some((card) => cardLabel(card, view) !== card.fullName) && (
                            <small className="d-block">
                                {actionCards(option.action)
                                    .map((card) => cardLabel(card, view))
                                    .join("; ")}
                            </small>
                        )}
                        {option.cost.length > 0 && option.action.type !== "Ink" && <span className="option-cost"> · {costText(option.cost)}</span>}
                    </button>
                ))}
            </div>
        </>
    );
}

function Mulligan({ request, onAnswer }: DecisionProps<"Action">) {
    const hand = request.actions.reduce<CardIdentifier[]>(
        (longest, option) => (option.action.type === "Alter Hand" && option.action.cards.length > longest.length ? option.action.cards : longest),
        [],
    );
    const [back, setBack] = useState<CardIdentifier[]>([]);
    const submit = (): void => {
        const match = request.actions.find(
            (option) =>
                option.action.type === "Alter Hand" &&
                option.action.cards.length === back.length &&
                option.action.cards.every((card) => back.some((other) => same(card, other))),
        );
        if (match) onAnswer({ type: "Action", option: match.option });
    };
    return (
        <>
            <div className="decision-title">Opening hand: tap cards to put them on the bottom of your deck and redraw.</div>
            <CardToggles cards={hand} chosen={back} onChange={(cards) => setBack(cards as CardIdentifier[])} />
            <button className="btn btn-primary w-100 mt-2" onClick={submit}>
                {back.length ? `Put back ${back.length}` : "Keep hand"}
            </button>
        </>
    );
}

/** Cards to pick: tappable card faces when every card is known, a checklist otherwise. */
function CardToggles(props: {
    cards: readonly PlayerCard[];
    chosen: readonly PlayerCard[];
    view?: GameStateView;
    characteristics?: PlayerUpdate["characteristics"];
    onChange(cards: PlayerCard[]): void;
}) {
    const toggle = (card: PlayerCard): void => {
        const on = props.chosen.some((other) => same(card, other));
        props.onChange(on ? props.chosen.filter((other) => !same(card, other)) : [...props.chosen, card]);
    };
    if (props.cards.every((card) => !("hidden" in card) && getCard(card.fullName)))
        return (
            <div className="card-row scroll">
                {props.cards.map(
                    (card, index) =>
                        !("hidden" in card) && (
                            <InstanceCard
                                key={index}
                                card={card}
                                view={props.view}
                                characteristics={props.characteristics}
                                selected={props.chosen.some((other) => same(card, other))}
                                onClick={() => toggle(card)}
                            />
                        ),
                )}
            </div>
        );
    return (
        <div className="list-group">
            {props.cards.map((card, index) => {
                const on = props.chosen.some((other) => same(card, other));
                return (
                    <label key={index} className="list-group-item py-1 small">
                        <input className="form-check-input me-2" type="checkbox" checked={on} onChange={() => toggle(card)} />
                        {cardLabel(card, props.view)}
                    </label>
                );
            })}
        </div>
    );
}

function ChooseCards({ request, view, characteristics, onAnswer }: DecisionProps<"Choose Cards">) {
    const [chosen, setChosen] = useState<PlayerCard[]>([]);
    const total = chosen.reduce((sum, card) => sum + (request.total?.values.find((entry) => same(entry.card, card))?.value ?? 0), 0);
    const valid =
        chosen.length >= request.min &&
        chosen.length <= request.max &&
        (!chosen.length || !request.required?.length || request.required.some((card) => chosen.some((entry) => same(card, entry)))) &&
        (!request.total || total <= request.total.max);
    const range =
        request.min === request.max ? `${request.min}` : request.max >= request.cards.length ? `at least ${request.min}` : `${request.min} to ${request.max}`;
    return (
        <>
            <div className="decision-title">
                Choose {range} card{request.max === 1 ? "" : "s"}
                {request.effect ? `: ${effectText(request.effect)}` : ""}
                {request.total ? ` (total value up to ${request.total.max})` : ""}
            </div>
            {!!request.required?.length && (
                <p className="small">A nonempty choice must include {request.required.map((card) => cardLabel(card, view)).join(" or ")}.</p>
            )}
            <CardToggles cards={request.cards} chosen={chosen} view={view} characteristics={characteristics} onChange={setChosen} />
            <button className="btn btn-primary w-100 mt-2" disabled={!valid} onClick={() => onAnswer(decide({ type: "Choose Cards", cards: chosen }))}>
                Confirm {chosen.length ? `(${chosen.length})` : "none"}
            </button>
        </>
    );
}

function OrderCards({ request, view, onAnswer }: DecisionProps<"Order Cards">) {
    const [order, setOrder] = useState<PlayerCard[]>([...request.cards]);
    const move = (index: number, by: number): void => {
        const next = [...order];
        [next[index], next[index + by]] = [next[index + by], next[index]];
        setOrder(next);
    };
    return (
        <>
            <div className="decision-title">Put these cards in order, first on top.</div>
            <ol className="list-group list-group-numbered">
                {order.map((card, index) => (
                    <li key={index} className="list-group-item py-1 small d-flex align-items-center">
                        <span className="flex-grow-1 ms-1">{cardLabel(card, view)}</span>
                        <button className="btn btn-sm btn-outline-secondary py-0" disabled={index === 0} onClick={() => move(index, -1)} aria-label="Move up">
                            ↑
                        </button>
                        <button
                            className="btn btn-sm btn-outline-secondary py-0 ms-1"
                            disabled={index === order.length - 1}
                            onClick={() => move(index, 1)}
                            aria-label="Move down"
                        >
                            ↓
                        </button>
                    </li>
                ))}
            </ol>
            <button className="btn btn-primary w-100 mt-2" onClick={() => onAnswer(decide({ type: "Order Cards", cards: order }))}>
                Confirm order
            </button>
        </>
    );
}

function ChooseAmount({ request, onAnswer }: DecisionProps<"Choose Amount">) {
    const [amount, setAmount] = useState(request.max);
    return (
        <>
            <div className="decision-title">
                Choose a number from {request.min} to {request.max}.
            </div>
            <div className="input-group input-group-sm">
                <input
                    className="form-control"
                    type="number"
                    min={request.min}
                    max={request.max}
                    value={amount}
                    onChange={(event) => setAmount(Math.floor(Number(event.target.value)))}
                />
                <button
                    className="btn btn-primary"
                    disabled={!(amount >= request.min && amount <= request.max)}
                    onClick={() => onAnswer(decide({ type: "Choose Amount", amount }))}
                >
                    Confirm
                </button>
            </div>
        </>
    );
}

const printedNames = [...new Set(catalog.flatMap((card) => card.names))].sort();

function NameCard({ onAnswer }: DecisionProps<"Name Card">) {
    const [name, setName] = useState("");
    return (
        <>
            <div className="decision-title">Name a card.</div>
            <div className="input-group input-group-sm">
                <input className="form-control" list="card-names" value={name} onChange={(event) => setName(event.target.value)} />
                <button className="btn btn-primary" disabled={!printedNames.includes(name)} onClick={() => onAnswer(decide({ type: "Name Card", name }))}>
                    Confirm
                </button>
            </div>
            <datalist id="card-names">
                {printedNames.map((option) => (
                    <option key={option} value={option} />
                ))}
            </datalist>
        </>
    );
}

function DistributeDamage({ request, onAnswer }: DecisionProps<"Distribute Damage Removal">) {
    const [amounts, setAmounts] = useState<number[]>(request.cards.map(() => 0));
    const total = amounts.reduce((sum, amount) => sum + amount, 0);
    return (
        <>
            <div className="decision-title">Remove up to {request.max} damage in total.</div>
            {request.cards.map((entry, index) => (
                <div key={index} className="input-group input-group-sm mb-1">
                    <span className="input-group-text flex-grow-1">{entry.card.fullName}</span>
                    <input
                        className="form-control"
                        style={{ maxWidth: "5rem" }}
                        type="number"
                        min={0}
                        max={entry.max}
                        value={amounts[index]}
                        onChange={(event) =>
                            setAmounts(
                                amounts.map((amount, other) =>
                                    other === index ? Math.max(0, Math.min(entry.max, Math.floor(Number(event.target.value)) || 0)) : amount,
                                ),
                            )
                        }
                    />
                </div>
            ))}
            <button
                className="btn btn-sm btn-primary mt-1"
                disabled={total > request.max}
                onClick={() =>
                    onAnswer(
                        decide({
                            type: "Distribute Damage Removal",
                            amounts: request.cards.map((entry, index) => ({ card: entry.card, amount: amounts[index] })),
                        }),
                    )
                }
            >
                Confirm
            </button>
        </>
    );
}
