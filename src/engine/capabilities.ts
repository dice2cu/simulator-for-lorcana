import type { Card } from "../model/card";
import type { ContinuousRule } from "../model/ability";
import type { Rules } from "./rules";

// Reject unsupported mechanics rather than executing an incomplete approximation.
export function assertSupportedBoard(rules: Rules): void {
    const identities = new Map<string, Set<number>>();
    for (const player of rules.players()) {
        const p = rules.player(player);
        const cards = [
            ...p.deck,
            ...p.hand,
            ...p.discard,
            ...(p.removed ?? []),
            ...p.inkwell.map((entry) => entry.card),
            ...p.play.flatMap((entry) => [
                entry.card,
                ...(entry.under?.map((under) => under.card) ?? []),
            ]),
        ];
        for (const card of cards) {
            let copies = identities.get(card.fullName);
            if (!copies) identities.set(card.fullName, (copies = new Set()));
            if (copies.has(card.i)) throw new Error("A physical card appears in multiple places");
            copies.add(card.i);
        }
    }
    if (
        rules
            .players()
            .some((n) =>
                rules
                    .player(n)
                    .modifiers?.some(
                        (m) =>
                            !(
                                "skipDrawStep" in m ||
                                "additionalInk" in m ||
                                "victoryLore" in m ||
                                "restriction" in m ||
                                "permission" in m ||
                                "trigger" in m ||
                                "rule" in m ||
                                "readyLimit" in m ||
                                "challengeLimit" in m ||
                                "inkEntersExerted" in m
                            ),
                    ),
            )
    )
        throw new Error("Unknown player modifier");
    for (const number of rules.players())
        for (const c of rules.player(number).play) {
            if (
                c.modifiers?.some(
                    (m) =>
                        !(
                            "stat" in m ||
                            "minimumStat" in m ||
                            "gainKeyword" in m ||
                            "loseKeyword" in m ||
                            "gainClassification" in m ||
                            "inkable" in m ||
                            "restriction" in m ||
                            "permission" in m ||
                            "preventDamage" in m ||
                            "gainAbility" in m ||
                            "loseAbility" in m ||
                            "countsAsName" in m ||
                            "rule" in m ||
                            "trigger" in m
                        ),
                )
            ) {
                throw new Error("Unknown card modifier");
            }
            assertSupportedDefinition(rules.definition(c.card));
        }
}

export function assertSupportedDefinition(definition: Card): void {
    const continuous = (rule: ContinuousRule): void => {
        if (rule.type === "Together") rule.rules.forEach(continuous);
        else if (rule.type === "Conditional") {
            continuous(rule.then);
            if (rule.otherwise) continuous(rule.otherwise);
        } else if (
            rule.type !== "Modify Cards" &&
            rule.type !== "Modify Players" &&
            rule.type !== "Reveal Cards" &&
            rule.type !== "Modify Cost" &&
            rule.type !== "Enter Play" &&
            rule.type !== "Challenge Damage" &&
            rule.type !== "Can Shift Onto" &&
            rule.type !== "Free Ability" &&
            rule.type !== "Additional Cost" &&
            rule.type !== "Alternate Cost"
        )
            throw new Error(`Unknown continuous rule: ${JSON.stringify(rule)}`);
    };
    for (const ability of definition.abilities ?? []) {
        if (ability.type === "Static") {
            if (ability.limit) {
                const priced = (rule: ContinuousRule): boolean =>
                    rule.type === "Modify Cost" ||
                    rule.type === "Free Ability" ||
                    (rule.type === "Together" && rule.rules.every(priced)) ||
                    (rule.type === "Conditional" &&
                        priced(rule.then) &&
                        (!rule.otherwise || priced(rule.otherwise)));
                if (!priced(ability.rule))
                    throw new Error("Limited non-price continuous rules require usage accounting");
            }
            continuous(ability.rule);
        }
    }
}
