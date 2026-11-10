import { expect, setSystemTime, test } from "bun:test";
import { homedir } from "node:os";
import path from "node:path";

import { listServices, shortestUniqueNames } from "../src/server/services.ts";

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

test("a service in the home directory is named after its executable", async () => {
  const child = Bun.spawn(
    [
      process.execPath,
      "-e",
      "console.log(Bun.serve({ port: 0, fetch: () => new Response() }).port)",
    ],
    { cwd: homedir(), stdout: "pipe" }
  );

  try {
    const reader = child.stdout
      .pipeThrough(new TextDecoderStream())
      .getReader();

    const port = Number((await reader.read()).value);

    setSystemTime(new Date(Date.now() + 120_000));

    expect(listServices().find((service) => service.port === port)?.name).toBe(
      path.basename(process.execPath)
    );
  } finally {
    setSystemTime();
    child.kill();
  }
});
