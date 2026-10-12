import { useState } from "react";

/** Copy plain text, including on HTTP pages without the Clipboard API. */
export function CopyButton({ text, label, disabled }: { text: string; label: string; disabled?: boolean }) {
    const [copied, setCopied] = useState<{ text: string; success: boolean }>();
    const copy = async (): Promise<void> => {
        try {
            if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
            else {
                const previous = document.activeElement;
                const field = document.createElement("textarea");
                field.value = text;
                field.style.position = "fixed";
                field.style.opacity = "0";
                document.body.append(field);
                try {
                    field.focus();
                    field.select();
                    if (!document.execCommand("copy")) throw new Error("Copy failed");
                } finally {
                    field.remove();
                    if (previous instanceof HTMLElement) previous.focus();
                }
            }
            setCopied({ text, success: true });
        } catch {
            setCopied({ text, success: false });
        }
    };
    return (
        <div className="d-flex align-items-center gap-2">
            {copied?.text === text && (
                <span className="small text-body-secondary" role="status">
                    {copied.success ? "Copied to clipboard." : "Could not copy. Please try again."}
                </span>
            )}
            <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                title={label}
                aria-label={label}
                disabled={disabled || !text.trim()}
                onClick={() => void copy()}
            >
                <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    focusable="false"
                >
                    <rect x="9" y="9" width="12" height="12" rx="2" />
                    <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
                </svg>
            </button>
        </div>
    );
}
