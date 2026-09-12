import { describe, expect, it } from "vitest";
import { MoneyError } from "@/lib/money";
import {
  normaliseModifierGroups,
  planGroupSync,
  type NormalisedGroup,
} from "@/lib/menu";

function group(overrides: Partial<NormalisedGroup> = {}): NormalisedGroup {
  return {
    id: null,
    name: "Select Pizza Flavour",
    minSelection: 1,
    maxSelection: 1,
    isRequired: true,
    modifiers: [
      { id: null, name: "Chicken Tikka", price: 0, isAvailable: true },
      { id: null, name: "Malai Boti", price: 0, isAvailable: true },
    ],
    ...overrides,
  };
}

describe("normaliseModifierGroups", () => {
  it("treats no groups as an empty list", () => {
    expect(normaliseModifierGroups(undefined)).toEqual([]);
    expect(normaliseModifierGroups(null)).toEqual([]);
    expect(normaliseModifierGroups([])).toEqual([]);
  });

  it("accepts a deal-style group and normalises its prices", () => {
    const [result] = normaliseModifierGroups([
      {
        name: "  Select 1 Litre Drink  ",
        isRequired: true,
        minSelection: 1,
        maxSelection: 1,
        modifiers: [
          { name: " Next Cola ", price: "0" },
          { name: "Sprite", price: 50 },
        ],
      },
    ]);

    expect(result.name).toBe("Select 1 Litre Drink");
    expect(result.modifiers).toEqual([
      { id: null, name: "Next Cola", price: 0, isAvailable: true },
      { id: null, name: "Sprite", price: 50, isAvailable: true },
    ]);
  });

  it("forces a required group to need at least one selection", () => {
    const [result] = normaliseModifierGroups([
      { name: "Size", isRequired: true, minSelection: 0, maxSelection: 1, modifiers: [{ name: "Large" }] },
    ]);
    expect(result.minSelection).toBe(1);
  });

  it("leaves an optional group able to take nothing", () => {
    const [result] = normaliseModifierGroups([
      {
        name: "Extra Topping",
        isRequired: false,
        minSelection: 0,
        maxSelection: 3,
        modifiers: [{ name: "Olives", price: 100 }],
      },
    ]);
    expect(result.minSelection).toBe(0);
    expect(result.maxSelection).toBe(3);
  });

  it("rejects a group with no options", () => {
    expect(() => normaliseModifierGroups([{ name: "Size", modifiers: [] }])).toThrow(MoneyError);
  });

  it("rejects a group with no name", () => {
    expect(() =>
      normaliseModifierGroups([{ name: "   ", modifiers: [{ name: "Large" }] }])
    ).toThrow(MoneyError);
  });

  it("rejects a maximum below the minimum", () => {
    expect(() =>
      normaliseModifierGroups([
        {
          name: "Flavours",
          minSelection: 3,
          maxSelection: 2,
          modifiers: [{ name: "A" }, { name: "B" }, { name: "C" }],
        },
      ])
    ).toThrow(/allows at most 2/);
  });

  it("rejects requiring more selections than the group offers", () => {
    expect(() =>
      normaliseModifierGroups([
        {
          name: "Flavours",
          minSelection: 3,
          maxSelection: 3,
          modifiers: [{ name: "A" }, { name: "B" }],
        },
      ])
    ).toThrow(/only has 2 option/);
  });

  it("rejects a duplicated option name, which the cashier could not tell apart", () => {
    expect(() =>
      normaliseModifierGroups([
        { name: "Flavours", modifiers: [{ name: "Tikka" }, { name: "tikka" }] },
      ])
    ).toThrow(/twice/);
  });

  it("rejects a negative surcharge", () => {
    expect(() =>
      normaliseModifierGroups([{ name: "Extras", modifiers: [{ name: "Cheese", price: -50 }] }])
    ).toThrow(MoneyError);
  });

  it("carries the sold-out flag through", () => {
    const [result] = normaliseModifierGroups([
      { name: "Extras", modifiers: [{ name: "Truffle Mayo", price: 200, isAvailable: false }] },
    ]);
    expect(result.modifiers[0].isAvailable).toBe(false);
  });
});

describe("planGroupSync", () => {
  it("creates every group when the product had none", () => {
    const plan = planGroupSync([], [group(), group({ name: "Select Drink" })]);

    expect(plan.createGroups).toHaveLength(2);
    expect(plan.updateGroups).toHaveLength(0);
    expect(plan.deleteGroupIds).toHaveLength(0);
  });

  it("deletes groups the editor removed", () => {
    const existing = [
      { id: "g1", modifiers: [{ id: "m1" }] },
      { id: "g2", modifiers: [{ id: "m2" }] },
    ];
    const plan = planGroupSync(existing, [
      group({ id: "g1", modifiers: [{ id: "m1", name: "Tikka", price: 0, isAvailable: true }] }),
    ]);

    expect(plan.deleteGroupIds).toEqual(["g2"]);
    expect(plan.updateGroups.map((u) => u.id)).toEqual(["g1"]);
  });

  it("updates a kept option in place rather than recreating it", () => {
    const existing = [{ id: "g1", modifiers: [{ id: "m1" }, { id: "m2" }] }];
    const plan = planGroupSync(existing, [
      group({
        id: "g1",
        modifiers: [
          { id: "m1", name: "Tikka (renamed)", price: 25, isAvailable: true },
          { id: null, name: "Brand New", price: 0, isAvailable: true },
        ],
      }),
    ]);

    const entry = plan.updateGroups[0];
    expect(entry.updateModifiers.map((m) => m.id)).toEqual(["m1"]);
    expect(entry.createModifiers.map((m) => m.name)).toEqual(["Brand New"]);
    expect(entry.deleteModifierIds).toEqual(["m2"]);
  });

  it("treats an id from another product as a new group, not a takeover", () => {
    const existing = [{ id: "g1", modifiers: [{ id: "m1" }] }];
    const plan = planGroupSync(existing, [group({ id: "someone-elses-group" })]);

    expect(plan.createGroups).toHaveLength(1);
    expect(plan.createGroups[0].id).toBeNull();
    expect(plan.deleteGroupIds).toEqual(["g1"]);
  });

  it("treats an option id from another group as new", () => {
    const existing = [{ id: "g1", modifiers: [{ id: "m1" }] }];
    const plan = planGroupSync(existing, [
      group({
        id: "g1",
        modifiers: [{ id: "m-from-elsewhere", name: "Sneaky", price: 0, isAvailable: true }],
      }),
    ]);

    const entry = plan.updateGroups[0];
    expect(entry.createModifiers.map((m) => m.id)).toEqual([null]);
    expect(entry.deleteModifierIds).toEqual(["m1"]);
  });

  it("clearing every group deletes them all", () => {
    const existing = [
      { id: "g1", modifiers: [{ id: "m1" }] },
      { id: "g2", modifiers: [] },
    ];
    const plan = planGroupSync(existing, []);

    expect(plan.deleteGroupIds).toEqual(["g1", "g2"]);
    expect(plan.createGroups).toHaveLength(0);
    expect(plan.updateGroups).toHaveLength(0);
  });

  it("an unchanged group produces no creates or deletes", () => {
    const existing = [{ id: "g1", modifiers: [{ id: "m1" }] }];
    const plan = planGroupSync(existing, [
      group({ id: "g1", modifiers: [{ id: "m1", name: "Tikka", price: 0, isAvailable: true }] }),
    ]);

    expect(plan.deleteGroupIds).toHaveLength(0);
    expect(plan.createGroups).toHaveLength(0);
    expect(plan.updateGroups[0].createModifiers).toHaveLength(0);
    expect(plan.updateGroups[0].deleteModifierIds).toHaveLength(0);
    expect(plan.updateGroups[0].updateModifiers).toHaveLength(1);
  });
});
