import queryString from "query-string";
import { describe, expect, it } from "vitest";

describe("router query decoding security", () => {
  it("keeps a decoded percent separator from recombining malformed bytes", () => {
    expect(queryString.parse("value=%84%D7%25%88%90").value).toBe(
      "%84%D7%%88%90",
    );
    expect(queryString.parse("value=%20%20%25%80").value).toBe(
      "  %%80",
    );
  });
});
