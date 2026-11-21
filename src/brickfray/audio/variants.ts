/**
 * Picks which recorded variant of a sound plays next. Never the variant just played; with three, the one before it
 * only one time in four; with four or more, neither of the last two. So no sound settles into an A-B-A-B
 * alternation. A two-variant sound may repeat once (rate and level jitter keep the repeat from being identical) but
 * never three times in a row.
 */
export class VariantPicker {
  private readonly recent = new Map<string, number[]>();

  constructor(private readonly random: () => number = Math.random) {}

  pick(id: string, count: number): number {
    if (count <= 1) return 0;
    const recent = this.recent.get(id) ?? [];
    const avoid = count === 2 ? (recent.length >= 2 && recent[0] === recent[1] ? 1 : 0) : count >= 4 ? 2 : 1;
    const banned = new Set(recent.slice(0, avoid));
    const options: number[] = [];
    for (let i = 0; i < count; i++) if (!banned.has(i)) options.push(i);
    const weight = (i: number) => (count === 3 && i === recent[1] ? 1 : 3);
    let roll = this.random() * options.reduce((sum, i) => sum + weight(i), 0);
    const choice = options.find((i) => (roll -= weight(i)) < 0) ?? options[options.length - 1]!;
    this.recent.set(id, [choice, ...recent].slice(0, 2));
    return choice;
  }
}
