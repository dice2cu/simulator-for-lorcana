import type { Card } from "../model/card";
import type { CardIdentifier, PlayerNumber } from "../model/identity";
import type { CardState, GameState, PlayerPosition } from "../model/game-state";
import type { TurnEvent, TurnStep } from "../model/turn";
import type { InputRequest } from "./resolution";
import type { Rules } from "./rules";
import { sameCard } from "./identity";
import { mapKept } from "./immutable";

export interface MoveOptions {
    position?: "Top" | "Bottom" | "Shuffle";
    exerted?: boolean;
    under?: CardIdentifier;
    faceDown?: boolean;
    wholeStack?: boolean;
    player?: PlayerNumber;
    actor?: PlayerNumber;
}

export interface MovementContext {
    rules(): Rules;
    position(): GameState;
    players(): readonly PlayerNumber[];
    definition(card: CardIdentifier): Card;
    holder(card: CardIdentifier): PlayerNumber;
    updatePlayer(player: PlayerNumber, change: (current: PlayerPosition) => Partial<PlayerPosition>): void;
    updateCard(card: CardIdentifier, change: (current: CardState) => Partial<CardState>): void;
    expireDepartures(cards: CardIdentifier[]): void;
    emit(event: TurnEvent, before: GameState): void;
    payMovement(card: CardIdentifier, destination: CardIdentifier, player: PlayerNumber, free: boolean): Generator<InputRequest, boolean, TurnStep>;
}

/** Moves physical cards and stacks together, resetting state when they leave play. */
export function moveCard(
    context: MovementContext,
    card: CardIdentifier,
    to: "Hand" | "Discard" | "Deck" | "Inkwell" | "Under" | "Play" | "Resolving",
    options: MoveOptions = {},
): CardIdentifier[] {
    const found = context.rules().locate(card);
    if (!found) return [];
    const before = context.position();
    const owner = found.state?.owner ?? found.under?.owner ?? found.player;
    const stack = found.state?.under?.map((entry) => entry.card) ?? [];
    const restored = options.wholeStack === false ? found.state?.under?.find((entry) => !entry.faceDown) : undefined;
    const restoredState: CardState | undefined =
        restored && found.state
            ? (() => {
                  const { owner, ...status } = found.state;
                  const restoredOwner = restored.owner ?? found.player;
                  return {
                      ...status,
                      card: restored.card,
                      ...(restoredOwner !== found.player ? { owner: restoredOwner } : {}),
                      under: found.state.under?.filter((entry) => entry !== restored),
                  };
              })()
            : undefined;
    if (found.zone === "Under")
        context.updatePlayer(found.player, (p) => ({
            play: p.play.map((state) => ({
                ...state,
                under: state.under?.filter((entry) => !sameCard(entry.card, card)),
            })),
        }));
    if (found.zone !== "Under")
        context.updatePlayer(found.player, (p) => {
            if (found.zone === "Hand") return { hand: p.hand.filter((other) => !sameCard(other, card)) };
            if (found.zone === "Deck") return { deck: p.deck.filter((other) => !sameCard(other, card)) };
            if (found.zone === "Discard") return { discard: p.discard.filter((other) => !sameCard(other, card)) };
            if (found.zone === "Inkwell") return { inkwell: p.inkwell.filter((other) => !sameCard(other.card, card)) };
            return {
                play: p.play.flatMap((other) => (!sameCard(other.card, card) ? [other] : restoredState ? [restoredState] : [])),
            };
        });
    const movingUnder = (found.state?.under ?? []).filter((entry) => options.wholeStack === true || (options.wholeStack !== false && !entry.faceDown));
    const moved = [card, ...movingUnder.map((entry) => entry.card)];
    const identities = [
        { card, owner },
        ...(found.state?.under ?? []).map((entry) => ({
            card: entry.card,
            owner: entry.owner ?? found.player,
        })),
    ];
    if (stack.length && !restoredState)
        for (const player of context.players()) {
            const discarded = identities
                .slice(1)
                .filter((entry) => entry.owner === player && !moved.some((card) => sameCard(card, entry.card)))
                .map((entry) => entry.card);
            if (discarded.length) context.updatePlayer(player, (p) => ({ discard: [...p.discard, ...discarded] }));
        }
    if (to === "Under") {
        if (!options.under) throw new Error("Missing under-stack destination");
        const controller = context.holder(options.under);
        context.updateCard(options.under, (current) => ({
            under: [
                ...(current.under ?? []),
                ...moved.map((card) => {
                    const owner = identities.find((entry) => sameCard(entry.card, card))?.owner;
                    return {
                        card,
                        faceDown: options.faceDown ?? false,
                        ...(owner !== controller ? { owner } : {}),
                    };
                }),
            ],
        }));
    } else if (to === "Play") {
        const controller = options.player ?? owner;
        context.updatePlayer(controller, (p) => ({
            play: [
                ...p.play,
                ...moved.map((card) => ({
                    card,
                    ...(controller !== owner ? { owner } : {}),
                    ...(context.definition(card).type === "Character" || context.definition(card).type === "Item"
                        ? { drying: true, exerted: options.exerted ?? false }
                        : {}),
                })),
            ],
        }));
    } else if (to !== "Resolving")
        for (const player of context.players()) {
            const own = moved.filter((card) => identities.some((entry) => sameCard(entry.card, card) && entry.owner === player));
            if (!own.length) continue;
            context.updatePlayer(player, (p) => {
                if (to === "Hand") return { hand: [...p.hand, ...own] };
                if (to === "Discard") return { discard: [...p.discard, ...own] };
                if (to === "Inkwell")
                    return {
                        inkwell: [
                            ...p.inkwell,
                            ...own.map((card) => ({
                                card,
                                exerted:
                                    (options.exerted ?? false) ||
                                    context
                                        .rules()
                                        .playerChanges(player)
                                        .some((change) => "inkEntersExerted" in change),
                            })),
                        ],
                    };
                return {
                    deck: options.position === "Top" ? [...own, ...p.deck] : [...p.deck, ...own],
                };
            });
        }
    if (found.zone === "Play") {
        context.expireDepartures([
            card,
            ...stack.filter(
                (card) => !restoredState || (!sameCard(card, restoredState.card) && !restoredState.under?.some((under) => sameCard(under.card, card))),
            ),
        ]);
        for (const player of context.players())
            context.updatePlayer(player, (p) => ({
                play: mapKept(p.play, (state) => {
                    if (!state.location || !sameCard(state.location, card)) return state;
                    const { location, ...rest } = state;
                    return rest;
                }),
            }));
        context.emit({ event: "Leave Play", card, player: found.player }, before);
    }
    if (to !== "Resolving") context.emit({ event: "Move Card", card, player: owner, from: found.zone, to }, before);
    if (to === "Under" && options.under) {
        for (const card of moved) context.emit({ event: "Put Under", player: options.actor ?? found.player, card, under: options.under }, before);
    }
    if (to !== "Resolving")
        for (const entry of identities.slice(1)) {
            if (restoredState && (sameCard(entry.card, restoredState.card) || restoredState.under?.some((under) => sameCard(under.card, entry.card)))) continue;
            const movedWithTop = moved.some((card) => sameCard(card, entry.card));
            context.emit(
                {
                    event: "Move Card",
                    card: entry.card,
                    player: entry.owner,
                    from: "Under",
                    to: movedWithTop ? to : "Discard",
                },
                before,
            );
        }
    if (restoredState)
        context.emit(
            {
                event: "Move Card",
                card: restoredState.card,
                player: found.player,
                from: "Under",
                to: "Play",
            },
            before,
        );
    if (to === "Inkwell") for (const card of moved) context.emit({ event: "Put Into Inkwell", player: context.holder(card), card }, before);
    return moved;
}

/** Effect and action movement share legality, payment and event handling. */
export function* moveToLocation(
    context: MovementContext,
    card: CardIdentifier,
    destination: CardIdentifier,
    player: PlayerNumber,
    free: boolean,
): Generator<InputRequest, boolean, TurnStep> {
    const character = context.rules().locate(card),
        location = context.rules().locate(destination);
    if (
        character?.zone !== "Play" ||
        location?.zone !== "Play" ||
        character.player !== location.player ||
        context.definition(card).type !== "Character" ||
        context.definition(destination).type !== "Location"
    )
        return false;
    if (context.rules().restricted(card, "Can't Move") || (character.state?.location && sameCard(character.state.location, destination))) return false;
    if (!(yield* context.payMovement(card, destination, player, free))) return false;
    const before = context.position();
    context.updateCard(card, () => ({ location: destination }));
    context.emit({ event: "Move To Location", card, player, location: destination }, before);
    return true;
}
