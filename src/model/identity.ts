/**
 * A generated number that uniquely identifies player for the duration of a game.
 */
export type PlayerNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/**
 * Assigned at setup, globally unique, unchanged by movement or replay.
 */
export interface CardIdentifier {
    /**
     * The unique name of the card.
     */
    readonly fullName: string;

    /**
     * A generated number that uniquely identifies an instance of the card within a deck for the duration of a game.
     * Setup assigns compact unique numbers independently of card names and deck-list
     * order, so a revealed identifier does not disclose copy counts or list positions.
     */
    readonly i: number;
}

/**
 * Known classifications from the catalog snapshot.
 * */
export type Subtype =
    | "Alien"
    | "Ally"
    | "Broom"
    | "Captain"
    | "Colossus"
    | "Deity"
    | "Detective"
    | "Dinosaur"
    | "Dragon"
    | "Dreamborn"
    | "Entangled"
    | "Fairy"
    | "Floodborn"
    | "Gargoyle"
    | "Ghost"
    | "Giant"
    | "Hero"
    | "Hunny"
    | "Hyena"
    | "Hyperia City"
    | "Illusion"
    | "Inventor"
    | "King"
    | "Knight"
    | "Madrigal"
    | "Mentor"
    | "Monster"
    | "Musketeer"
    | "Obstacle"
    | "Pirate"
    | "Prince"
    | "Princess"
    | "Puppy"
    | "Queen"
    | "Racer"
    | "Red Panda"
    | "Robot"
    | "Seven Dwarfs"
    | "Song"
    | "Sorcerer"
    | "Storyborn"
    | "Super"
    | "Team"
    | "Tigger"
    | "Titan"
    | "Toy"
    | "Villain"
    | "Vineling"
    | "Whisper";
