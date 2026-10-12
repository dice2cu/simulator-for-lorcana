import { afterEach, describe, expect, it, vi } from "vitest";
import { createDeckId } from "./storage";

afterEach(() => vi.unstubAllGlobals());

describe("deck IDs", () => {
    it("works when randomUUID is unavailable, as on an HTTP page", () => {
        const getRandomValues = crypto.getRandomValues.bind(crypto);
        vi.stubGlobal("crypto", { getRandomValues });
        const id = createDeckId();
        expect(id).toMatch(/^[0-9a-f]{32}$/);
        expect(createDeckId()).not.toBe(id);
    });

    it("keeps leading zeroes so all random bytes contribute to the ID", () => {
        vi.stubGlobal("crypto", {
            getRandomValues: (bytes: Uint8Array) => {
                bytes.set(Array.from({ length: 16 }, (_, index) => index));
                return bytes;
            },
        });
        expect(createDeckId()).toBe("000102030405060708090a0b0c0d0e0f");
    });
});
