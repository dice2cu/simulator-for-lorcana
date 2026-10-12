/** The reference deck files, embedded by build.mjs. */
declare module "virtual:reference-decks" {
    const decks: readonly { name: string; text: string }[];
    export default decks;
}
