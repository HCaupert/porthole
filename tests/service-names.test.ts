import { expect, test } from "bun:test";

import { shortestUniqueNames } from "../src/server/services.ts";

test("a lone directory is named after its last segment", () => {
  expect(shortestUniqueNames(["/home/me/bar"]).get("/home/me/bar")).toBe("bar");
});

test("directories with the same last segment get the shortest unique tail", () => {
  const names = shortestUniqueNames([
    "/work/foo/bar",
    "/work/baz/bar",
    "/work/qux",
  ]);

  expect(names.get("/work/foo/bar")).toBe("foo/bar");
  expect(names.get("/work/baz/bar")).toBe("baz/bar");
  expect(names.get("/work/qux")).toBe("qux");
});

test("services in the same directory share one name", () => {
  const names = shortestUniqueNames(["/work/app", "/work/app", "/other/app"]);

  expect(names.get("/work/app")).toBe("work/app");
});
