import type { ReactNode } from "react";
import type { Card } from "../simulator";

export const inkClass = (card: Card): string => (card.colors.length ? `ink-${card.colors[0]}` : "");

/**
 * Printed rules text as paragraphs, one per ability. The catalog keeps the printed
 * line breaks, which only fit the real card's width, so lines are joined unless one
 * ends a sentence or the next starts an ability name in capitals or a • option.
 */
export function cardParagraphs(text: string): string[] {
    const paragraphs: string[] = [];
    for (const line of text.split("\n").map((part) => part.trim())) {
        const last = paragraphs.at(-1);
        if (last === undefined || /[.)!?"”]$/.test(last) || /^([A-Z][A-Z'’!?,.-]+\b|•)/.test(line)) paragraphs.push(line);
        else paragraphs[paragraphs.length - 1] = `${last} ${line}`;
    }
    return paragraphs.filter(Boolean);
}

/** A leading ability name in capitals, such as "SOMEONE TO CARE FOR", shown in bold. */
function Paragraph({ text }: { text: string }) {
    const title = /^[A-Z0-9'’!?,.&-]{2,} (?:(?:[A-Z0-9'’!?,.&-]{2,}|[A-Z]) )*/.exec(text)?.[0] ?? "";
    return (
        <p>
            {title && <strong>{title}</strong>}
            {text.slice(title.length)}
        </p>
    );
}

/** Complete printed rules, without truncating long abilities. */
export function CardText({ text }: { text?: string }) {
    return (
        <>
            {cardParagraphs(text ?? "").map((paragraph, index) => (
                <Paragraph key={index} text={paragraph} />
            ))}
        </>
    );
}

/** The line under the name: classifications for characters, the card type otherwise. */
function typeLine(card: Card): string {
    if (card.type === "Character") return card.subtypes.join(" · ");
    return [card.type, ...card.subtypes].join(" · ");
}

interface CardFaceProps {
    readonly card: Card;
    /** The whole text at a readable size, instead of a fixed-size card. */
    readonly full?: boolean;
    readonly selected?: boolean;
    readonly exerted?: boolean;
    /** Damage counters, shown in the top corner. */
    readonly damage?: number;
    /** Effective board stats. Omit when displaying a printed card outside play. */
    readonly characteristics?: { readonly strength: number; readonly willpower: number; readonly lore: number };
    readonly label?: string;
    /** Other game state, shown along the bottom. */
    readonly badges?: ReactNode;
    onClick?(): void;
}

/** A readable card summary, with complete rules in its expanded view. */
export function CardFace({ card, full, selected, exerted, damage, characteristics, label, badges, onClick }: CardFaceProps) {
    const strength = characteristics?.strength ?? (card.type === "Character" ? card.strength : 0);
    const willpower = characteristics?.willpower ?? (card.type === "Character" || card.type === "Location" ? card.willpower : 0);
    const lore = characteristics?.lore ?? (card.type === "Character" || card.type === "Location" ? card.lore : 0);
    const [name, ...version] = card.fullName.split(" - ");
    const classes = ["lcard", inkClass(card), full ? "full" : "", selected ? "selected" : "", exerted ? "exerted" : "", onClick ? "clickable" : ""];
    return (
        <div
            className={classes.filter(Boolean).join(" ")}
            onClick={onClick}
            role={onClick ? "button" : undefined}
            tabIndex={onClick ? 0 : undefined}
            aria-label={label ?? card.fullName}
            aria-pressed={onClick ? !!selected : undefined}
            onKeyDown={
                onClick
                    ? (event) => {
                          if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              onClick();
                          }
                      }
                    : undefined
            }
            title={full ? undefined : (label ?? card.fullName)}
        >
            <div className="lcard-top">
                <span className={`lcard-cost ${card.inkwell ? "inkable" : ""}`} title={card.inkwell ? "Inkable" : "Not inkable"}>
                    Cost {card.cost}
                </span>
                {card.type === "Location" && (
                    <span className="lcard-move" title="Move cost">
                        {card.moveCost} ⟶
                    </span>
                )}
                {!!damage && (
                    <span className="lcard-damage" title={`${damage} damage`}>
                        {damage} damage
                    </span>
                )}
            </div>
            <div className="lcard-banner">
                <div className="lcard-names">
                    <div className="lcard-name">{name}</div>
                    {version.length > 0 && <div className="lcard-version">{version.join(" - ")}</div>}
                </div>
                {card.type === "Character" && (
                    <div className="lcard-stats">
                        <span className="strength" title="Strength">
                            Strength {strength}
                        </span>
                        <span className="willpower" title="Willpower">
                            Willpower {willpower}
                        </span>
                    </div>
                )}
                {card.type === "Location" && (
                    <div className="lcard-stats">
                        <span className="willpower" title="Willpower">
                            Willpower {willpower}
                        </span>
                    </div>
                )}
            </div>
            <div className="lcard-type">{typeLine(card)}</div>
            <div className="lcard-body">
                <div className="lcard-text">
                    <CardText text={card.fullText} />
                </div>
                {(card.type === "Character" || card.type === "Location") && lore > 0 && (
                    <div className="lcard-lore" title={`${lore} lore`}>
                        Lore {lore}
                    </div>
                )}
            </div>
            {badges && <div className="lcard-badges">{badges}</div>}
        </div>
    );
}

/** A face-down card, for hidden cards in hand. */
export function CardBack() {
    return <div className="lcard back" />;
}

/** A deck's or card's inks as small colored hexagons. */
export function Inks({ inks }: { inks: readonly string[] }) {
    return (
        <span className="inks" title={inks.join(" / ")}>
            {inks.map((ink) => (
                <span key={ink} className={`ink-dot ink-${ink}`} />
            ))}
        </span>
    );
}

/** A card's cost in its ink color: a hexagon when inkable, like the printed card. */
export function MiniCost({ card }: { card: Card }) {
    return <span className={`mini-cost ${inkClass(card)} ${card.inkwell ? "inkable" : ""}`}>{card.cost}</span>;
}
