import { describe, expect, it } from "vitest";
import {
  BOARDING_LOCAL,
  CABIN_BOX,
  CABIN_ENTRY,
  CABIN_EXIT,
  CABIN_SPOT,
  CHEST_SPOT,
  DECK,
  DECK_ENTRY,
  DECK_Y,
  GANGWAY,
  GOOD_SPOTS,
  HATCH_SPOT,
  HOLD_BOX,
  HOLD_ENTRY,
  HOLD_ORIGIN,
  SHIP,
  groundAt,
  inBox,
  resolve,
} from "../game/world";

describe("Boat placement regressions", () => {
  it("aligns the gangway with the actual boarding opening after ship rotation", () => {
    expect(GANGWAY.x).toBeCloseTo(1.68);
    expect(GANGWAY.x).toBeCloseTo(SHIP.x + BOARDING_LOCAL.z * SHIP.scale);
    expect(groundAt(GANGWAY.x, GANGWAY.z2 + 0.1).walkable).toBe(true);
    expect(groundAt(GANGWAY.x, DECK.z2 - 0.4).zone).toBe("pont");
  });
  it("keeps the hold beneath the boat and ladder beneath its hatch", () => {
    expect(HOLD_ORIGIN).toEqual({ x: 6, y: DECK_Y - 3.4, z: -22 });
    expect(HOLD_ENTRY.x - HATCH_SPOT.x).toBeCloseTo(1.2);
    expect(HOLD_ENTRY.z).toBe(HATCH_SPOT.z);
    expect(inBox(HOLD_ENTRY.x, HOLD_ENTRY.z, HOLD_BOX)).toBe(true);
    expect(inBox(DECK_ENTRY.x, DECK_ENTRY.z, DECK)).toBe(true);
  });
  it("does not confuse overlapping deck and hold floors", () => {
    expect(groundAt(4, -22)).toEqual({ y: 2.2, walkable: true, zone: "pont" });
    expect(groundAt(4, -22, true)).toEqual({ y: HOLD_ORIGIN.y, walkable: true, zone: "cale" });
    expect(groundAt(4, -10, true).walkable).toBe(false);
  });
  it("keeps hold collisions independent from deck cargo", () => {
    expect(resolve(-2, -20, 0.4, true)).toEqual({ x: -2, z: -20 });
    expect(resolve(-2, -20)).not.toEqual({ x: -2, z: -20 });
    const p = resolve(HOLD_BOX.x1 - 0.1, -22, 0.4, true);
    expect(p.x).toBeGreaterThan(HOLD_BOX.x1);
  });
  it("moves the salt cargo to the hold floor under the ship", () => {
    const salt = GOOD_SPOTS.find((g) => g.good === "sel");
    expect(salt).toMatchObject({ x: 6, y: HOLD_ORIGIN.y, z: -20.2 });
  });
  it("keeps the captain cabin entry inside the cabin volume and the exit on deck", () => {
    expect(CABIN_ENTRY).toMatchObject({ x: 17.3, y: DECK_Y, z: -21.5 });
    expect(inBox(CABIN_ENTRY.x, CABIN_ENTRY.z, CABIN_BOX)).toBe(true);
    expect(groundAt(CABIN_ENTRY.x, CABIN_ENTRY.z, false, true)).toEqual({
      y: DECK_Y,
      walkable: true,
      zone: "cabine",
    });
    expect(groundAt(CABIN_EXIT.x, CABIN_EXIT.z).zone).toBe("pont");
    expect(Math.hypot(CHEST_SPOT.x - CABIN_SPOT.x, CHEST_SPOT.z - CABIN_SPOT.z)).toBeLessThan(2);
  });

  it("constrains movement inside the cabin when the cabin mode is active", () => {
    const p = resolve(CABIN_BOX.x2 + 3, CABIN_BOX.z1 - 3, 0.4, false, true);
    expect(p.x).toBeLessThanOrEqual(CABIN_BOX.x2 - 0.4);
    expect(p.x).toBeGreaterThanOrEqual(CABIN_BOX.x1 + 0.4);
    expect(p.z).toBeGreaterThanOrEqual(CHEST_SPOT.z + 0.7 + 0.4);
    expect(p.z).toBeLessThanOrEqual(CABIN_BOX.z2 - 0.4);
  });
});
