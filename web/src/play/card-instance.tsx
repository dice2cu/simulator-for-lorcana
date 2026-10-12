import { CardFace } from "../cards/card-view";
import { getCard, sameCard, type CardIdentifier, type GameStateView, type PlayerCard, type PlayerUpdate } from "../simulator";

/** Positions and current state distinguish identical copies without exposing hidden identities. */
export function cardLabel(card: PlayerCard, view?: GameStateView): string {
    if ("hidden" in card) return `Hidden card ${card.hidden + 1}`;
    for (const [player, position] of Object.entries(view?.players ?? {})) {
        if (!position) continue;
        const index = position.play.findIndex((state) => sameCard(state.card, card));
        if (index < 0) continue;
        const state = position.play[index];
        const location = state.location && position.play.findIndex((entry) => sameCard(entry.card, state.location));
        return [
            card.fullName,
            `Player ${player}, in play ${index + 1}`,
            state.exerted ? "exerted" : "ready",
            state.drying ? "drying" : "",
            `${state.damage ?? 0} damage`,
            state.location ? `at ${state.location.fullName}${location !== undefined && location >= 0 ? ` (in play ${location + 1})` : ""}` : "",
        ]
            .filter(Boolean)
            .join(" · ");
    }
    return card.fullName;
}

export function InstanceCard(props: {
    card: CardIdentifier;
    view?: GameStateView;
    characteristics?: PlayerUpdate["characteristics"];
    selected?: boolean;
    full?: boolean;
    onClick?(): void;
}) {
    const printed = getCard(props.card.fullName);
    if (!printed) return <span>{props.card.fullName}</span>;
    const state = Object.values(props.view?.players ?? {})
        .flatMap((player) => player?.play ?? [])
        .find((entry) => sameCard(entry.card, props.card));
    const label = cardLabel(props.card, props.view);
    return (
        <CardFace
            card={printed}
            full={props.full}
            selected={props.selected}
            onClick={props.onClick}
            label={label}
            exerted={state?.exerted}
            damage={state?.damage}
            characteristics={props.characteristics?.find((entry) => sameCard(entry.card, props.card))}
            badges={
                state && (
                    <>
                        <span className="badge text-bg-light">{state.exerted ? "Exerted" : "Ready"}</span>
                        {state.drying && <span className="badge text-bg-secondary">Drying</span>}
                        {state.location && <span className="badge text-bg-secondary">At {state.location.fullName}</span>}
                        {!!state.under?.length && <span className="badge text-bg-dark">{state.under.length} under</span>}
                        {!!state.modifiers?.length && <span className="badge text-bg-warning">modified</span>}
                    </>
                )
            }
        />
    );
}
