import { describe, expect, it } from "vitest";

import { toAmenityView } from "../src/lib/amenity-view";

describe("amenity API view conversion", () => {
  it("preserves the server numeric id used by booking mutations", () => {
    const view = toAmenityView({
      id: 1,
      name: "gym",
      description: "Floor 12 gym",
      icon: "fitness",
      category: "recreation",
      capacity: 20,
      rules: "Bring a towel\nResidents only",
    });

    expect(view).toMatchObject({ id: 1, name: "gym", capacity: 20 });
    expect(view?.rules).toEqual(["Bring a towel", "Residents only"]);
  });

  it("normalizes nullable display fields without inventing facility details", () => {
    const view = toAmenityView({
      id: 2,
      name: "pool",
      description: null,
      icon: "pool",
      category: "wellness",
      capacity: 30,
      rules: null,
    });

    expect(view?.description).toBe("");
    expect(view?.rules).toEqual([]);
  });

  it.each([false, 0])("rejects malformed or inactive amenity payloads (%s)", (isActive) => {
    expect(toAmenityView({ id: "1", name: "gym" })).toBeNull();
    expect(toAmenityView({
      id: 1,
      name: "gym",
      description: null,
      icon: "fitness",
      category: "recreation",
      capacity: 20,
      rules: null,
      isActive,
    })).toBeNull();
  });
});
