/**
 * Modifier group editing.
 *
 * A "deal" in this menu is an ordinary product whose choices are expressed as modifier
 * groups: Deal 1 is one product at Rs. 1,499 with a required "pick a pizza flavour"
 * group, a required "pick a drink" group, and an optional extras group. Until now
 * those groups could only be created by a script, so this module gives the Menu screen
 * a way to build and edit them.
 *
 * The planning step is kept pure so it can be tested without a database.
 */
import { z } from "zod";
import { MoneyError, parsePositiveMoney, toMajor } from "@/lib/money";

const MAX_GROUPS_PER_PRODUCT = 20;
const MAX_OPTIONS_PER_GROUP = 50;
const MAX_NAME_LENGTH = 80;

const modifierInputSchema = z.object({
  id: z.string().min(1).nullish(),
  name: z.string().trim().min(1, "Option name is required").max(MAX_NAME_LENGTH),
  price: z.union([z.number(), z.string()]).optional().default(0),
  isAvailable: z.boolean().optional().default(true),
});

const groupInputSchema = z.object({
  id: z.string().min(1).nullish(),
  name: z.string().trim().min(1, "Group name is required").max(MAX_NAME_LENGTH),
  minSelection: z.coerce.number().int().min(0).max(MAX_OPTIONS_PER_GROUP).optional().default(0),
  maxSelection: z.coerce.number().int().min(1).max(MAX_OPTIONS_PER_GROUP).optional().default(1),
  isRequired: z.boolean().optional().default(false),
  modifiers: z
    .array(modifierInputSchema)
    .min(1, "A group needs at least one option")
    .max(MAX_OPTIONS_PER_GROUP),
});

export const modifierGroupsSchema = z.array(groupInputSchema).max(MAX_GROUPS_PER_PRODUCT);

export type ModifierGroupInput = z.infer<typeof groupInputSchema>;

/** A group ready to write: names trimmed, prices normalised, rules checked. */
export interface NormalisedModifier {
  id: string | null;
  name: string;
  price: number;
  isAvailable: boolean;
}

export interface NormalisedGroup {
  id: string | null;
  name: string;
  minSelection: number;
  maxSelection: number;
  isRequired: boolean;
  modifiers: NormalisedModifier[];
}

/**
 * Validate and normalise the groups submitted by the Menu screen.
 *
 * Throws `MoneyError` on anything the cashier can fix, so routes report it as a 400
 * with the message intact rather than a bare 500.
 */
export function normaliseModifierGroups(input: unknown): NormalisedGroup[] {
  if (input === undefined || input === null) return [];

  const parsed = modifierGroupsSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new MoneyError(issue ? issue.message : "Invalid option groups");
  }

  return parsed.data.map((group) => {
    const modifiers = group.modifiers.map((modifier) => ({
      id: modifier.id ?? null,
      name: modifier.name.trim(),
      price: toMajor(parsePositiveMoney(modifier.price, `Price for "${modifier.name.trim()}"`)),
      isAvailable: modifier.isAvailable,
    }));

    // A group the cashier must answer needs at least one selection to be meaningful.
    const minSelection = group.isRequired ? Math.max(1, group.minSelection) : group.minSelection;
    const maxSelection = group.maxSelection;

    if (maxSelection < minSelection) {
      throw new MoneyError(
        `"${group.name}" allows at most ${maxSelection} selection(s) but requires at least ${minSelection}`
      );
    }
    if (minSelection > modifiers.length) {
      throw new MoneyError(
        `"${group.name}" requires ${minSelection} selection(s) but only has ${modifiers.length} option(s)`
      );
    }

    const duplicate = findDuplicateName(modifiers.map((m) => m.name));
    if (duplicate) {
      throw new MoneyError(`"${group.name}" lists the option "${duplicate}" twice`);
    }

    return {
      id: group.id ?? null,
      name: group.name.trim(),
      minSelection,
      maxSelection,
      isRequired: group.isRequired,
      modifiers,
    };
  });
}

function findDuplicateName(names: string[]): string | null {
  const seen = new Set<string>();
  for (const name of names) {
    const key = name.toLowerCase();
    if (seen.has(key)) return name;
    seen.add(key);
  }
  return null;
}

export interface ExistingGroup {
  id: string;
  modifiers: Array<{ id: string }>;
}

export interface GroupSyncPlan {
  deleteGroupIds: string[];
  createGroups: NormalisedGroup[];
  updateGroups: Array<{
    id: string;
    group: NormalisedGroup;
    createModifiers: NormalisedModifier[];
    updateModifiers: NormalisedModifier[];
    deleteModifierIds: string[];
  }>;
}

/**
 * Work out the minimum set of writes to turn `existing` into `incoming`.
 *
 * Rows the editor still references are updated in place rather than deleted and
 * recreated, so a modifier that past orders point at keeps its identity. Rows that are
 * genuinely removed are deleted: the `OrderItemModifier` snapshot keeps the name and
 * price it was sold at, so history reads correctly either way.
 *
 * Ids that do not belong to this product are treated as new, so a crafted request
 * cannot reassign another product's option group to itself.
 */
export function planGroupSync(
  existing: ExistingGroup[],
  incoming: NormalisedGroup[]
): GroupSyncPlan {
  const existingById = new Map(existing.map((group) => [group.id, group]));
  const keptGroupIds = new Set<string>();

  const createGroups: NormalisedGroup[] = [];
  const updateGroups: GroupSyncPlan["updateGroups"] = [];

  for (const group of incoming) {
    const match = group.id ? existingById.get(group.id) : undefined;

    if (!match) {
      createGroups.push({ ...group, id: null });
      continue;
    }

    keptGroupIds.add(match.id);

    const existingModifierIds = new Set(match.modifiers.map((m) => m.id));
    const keptModifierIds = new Set<string>();

    const createModifiers: NormalisedModifier[] = [];
    const updateModifiers: NormalisedModifier[] = [];

    for (const modifier of group.modifiers) {
      if (modifier.id && existingModifierIds.has(modifier.id)) {
        keptModifierIds.add(modifier.id);
        updateModifiers.push(modifier);
      } else {
        createModifiers.push({ ...modifier, id: null });
      }
    }

    updateGroups.push({
      id: match.id,
      group,
      createModifiers,
      updateModifiers,
      deleteModifierIds: [...existingModifierIds].filter((id) => !keptModifierIds.has(id)),
    });
  }

  return {
    deleteGroupIds: existing.map((g) => g.id).filter((id) => !keptGroupIds.has(id)),
    createGroups,
    updateGroups,
  };
}
