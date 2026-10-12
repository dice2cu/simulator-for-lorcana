/** A rejected answer can be corrected without advancing its resolution. */
export class InvalidInput extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'InvalidInput';
    }
}
