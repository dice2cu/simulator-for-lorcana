import { CardBack } from "../cards/card-view";
import { InstanceCard } from "./card-instance";
import {
    getCard,
    type CardIdentifier,
    type CardStatePlayerView,
    type GameStateView,
    type PlayerNumber,
    type PlayerPositionView,
    type PlayerUpdate,
} from "../simulator";

const same = (a: CardIdentifier | undefined, b: CardIdentifier | undefined): boolean => !!a && !!b && a.fullName === b.fullName && a.i === b.i;

interface BoardProps {
    readonly view: GameStateView;
    readonly viewer: PlayerNumber;
    readonly names: Readonly<Partial<Record<PlayerNumber, string>>>;
    readonly focus?: CardIdentifier;
    readonly characteristics?: PlayerUpdate["characteristics"];
    onFocus(card: CardIdentifier): void;
}

/** One player's view of the game: opponents above, the viewer below. */
export function Board(props: BoardProps) {
    const seats = (Object.keys(props.view.players).map(Number) as PlayerNumber[]).sort((a, b) => (a === props.viewer ? 1 : b === props.viewer ? -1 : a - b));
    return (
        <div>
            {seats.map((player) => (
                <PlayerArea key={player} {...props} player={player} position={props.view.players[player]!} />
            ))}
        </div>
    );
}

/** A player's lore, ink and cards. The viewer's characters sit nearest the opponent's, as across a table. */
function PlayerArea(props: BoardProps & { player: PlayerNumber; position: PlayerPositionView }) {
    const { position, player, viewer, view } = props;
    const count = (zone: PlayerPositionView["hand"]): number => (typeof zone === "number" ? zone : zone.length);
    const ready = position.inkwell.filter((ink) => !ink.exerted).length;
    const active = view.turn.player === player;
    const you = player === viewer;
    const characters = position.play.filter((card) => getCard(card.card.fullName)?.type === "Character");
    const others = position.play.filter((card) => getCard(card.card.fullName)?.type !== "Character");
    const hand = typeof position.hand !== "number" && position.hand.some(Boolean) ? position.hand : undefined;
    const zones = [
        <Zone key="characters" label="Characters" cards={characters} {...props} />,
        others.length > 0 && <Zone key="others" label="Items and locations" cards={others} {...props} />,
    ];
    return (
        <section className={`card player-area ${active ? "active" : ""}`}>
            <div className="player-head">
                <span className="player-name">{props.names[player] ?? `Player ${player}`}</span>
                {you && <span className="chip">You</span>}
                {active && <span className="chip gold">Turn {view.turn.number}</span>}
                <div className="lore-meter" title={`${position.lore} of 20 lore`}>
                    <span className="value">
                        {position.lore} <small>/ 20 ◊</small>
                    </span>
                    <div className="track">
                        <div className="fill" style={{ width: `${Math.min(100, (100 * position.lore) / 20)}%` }} />
                    </div>
                </div>
                <div className="player-stats">
                    <span title={`${ready} of ${position.inkwell.length} ink ready`}>
                        <span className="ink-pips me-1">
                            {position.inkwell.map((ink, index) => (
                                <span key={index} className={`ink-pip ${ink.exerted ? "used" : ""}`} />
                            ))}
                        </span>
                        <strong>
                            {ready}/{position.inkwell.length}
                        </strong>{" "}
                        ink{position.inkDrops ? ` + ${position.inkDrops}` : ""}
                    </span>
                    <span>
                        <strong>{count(position.hand)}</strong> in hand
                    </span>
                    <span>
                        <strong>{count(position.deck)}</strong> in deck
                    </span>
                    <span>
                        <strong>{position.discard.length}</strong> discarded
                    </span>
                </div>
            </div>
            {you ? zones.reverse() : zones}
            {hand && (
                <>
                    <div className="zone-label">Hand</div>
                    <div className="card-row scroll">
                        {hand.map((card, index) => (card ? <Face key={`${card.fullName}#${card.i}`} card={card} {...props} /> : <CardBack key={index} />))}
                    </div>
                </>
            )}
            {position.discard.length > 0 && (
                <details className="zone-details">
                    <summary>Discard ({position.discard.length})</summary>
                    <div className="card-row scroll">
                        {position.discard.map((card) => (
                            <Face key={`${card.fullName}#${card.i}`} card={card} {...props} />
                        ))}
                    </div>
                </details>
            )}
        </section>
    );
}

function Zone(props: BoardProps & { label: string; cards: readonly CardStatePlayerView[] }) {
    return (
        <>
            <div className="zone-label">{props.label}</div>
            <div className="card-row">
                {props.cards.length === 0 && <div className="zone-empty">No {props.label.toLowerCase()} in play</div>}
                {props.cards.map((state) => (
                    <Face key={`${state.card.fullName}#${state.card.i}`} card={state.card} state={state} {...props} />
                ))}
            </div>
        </>
    );
}

/** A card with its state in play: damage, exerted, drying, cards under it and its location. */
function Face(props: BoardProps & { card: CardIdentifier; state?: CardStatePlayerView }) {
    return (
        <InstanceCard
            card={props.card}
            view={props.view}
            characteristics={props.characteristics}
            selected={same(props.focus, props.card)}
            onClick={() => props.onFocus(props.card)}
        />
    );
}
