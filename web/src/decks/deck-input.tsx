import { useId } from "react";
import { CopyButton } from "../copy-button";
import type { DeckCheck } from "./library";

/** The same editable deck-list format in the library and simulation setup. */
export function DeckInput({
    text,
    check,
    readOnly,
    disabled,
    onChange,
}: {
    text: string;
    check: DeckCheck;
    readOnly?: boolean;
    disabled?: boolean;
    onChange(text: string): void;
}) {
    const id = useId();
    return (
        <div className="mb-3">
            <div className="d-flex justify-content-between align-items-center mb-1">
                <label className="form-label mb-0" htmlFor={id}>
                    Cards and quantities
                </label>
                <div className="d-flex align-items-center gap-2">
                    <span className="small text-body-secondary" aria-live="polite">
                        {check.size} cards
                    </span>
                    <CopyButton text={text} label="Copy deck text" disabled={disabled} />
                </div>
            </div>
            <textarea
                id={id}
                className="form-control deck-text"
                value={text}
                readOnly={readOnly}
                disabled={disabled}
                spellCheck={false}
                aria-describedby={`${id}-help`}
                aria-invalid={text.trim() !== "" && check.problems.length > 0}
                placeholder={"4 Lady - Family Dog\n4 Tramp - Enterprising Dog"}
                onChange={(event) => onChange(event.target.value)}
            />
            <p id={`${id}-help`} className="small text-body-secondary mt-2 mb-0">
                One card per line: quantity followed by the full card name. At least 60 cards.
            </p>
            {text.trim() !== "" && check.problems.length > 0 && (
                <div className="alert alert-danger small mt-2 mb-0" role="status">
                    <ul className="mb-0 ps-3">
                        {check.problems.map((problem) => (
                            <li key={problem}>{problem}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
