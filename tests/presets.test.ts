import { describe, expect, test } from "bun:test";

import { presets } from "../src/server/presets.ts";

const body = JSON.stringify({ action: "opened" });

describe("presets", () => {
  test("github signs what it verifies", () => {
    const headers = presets.github.sign(
      { "x-github-event": "issues" },
      body,
      "s3cret"
    );

    expect(presets.github.verify(headers, body, "s3cret")).toBe(true);
    expect(presets.github.verify(headers, body, "other")).toBe(false);
    expect(
      presets.github.eventName({ method: "POST", path: "/", headers, body })
    ).toBe("issues.opened");
  });

  test("jira signs what it verifies", () => {
    const headers = presets.jira.sign({}, body, "s3cret");

    expect(presets.jira.verify(headers, body, "s3cret")).toBe(true);
    expect(presets.jira.verify({}, body, "s3cret")).toBe(false);
  });

  test("gitlab signs what it verifies and names the event", () => {
    const secret = `whsec_${Buffer.from("s3cret").toString("base64")}`;

    const merge = JSON.stringify({
      object_kind: "merge_request",
      object_attributes: { action: "open" },
    });

    const headers = presets.gitlab.sign(
      { "webhook-id": "msg_1" },
      merge,
      secret
    );

    expect(presets.gitlab.verify(headers, merge, secret)).toBe(true);
    expect(presets.gitlab.verify(headers, `${merge} `, secret)).toBe(false);
    expect(
      presets.gitlab.eventName({
        method: "POST",
        path: "/",
        headers,
        body: merge,
      })
    ).toBe("merge_request.open");
  });

  test("generic names the event after the request", () => {
    expect(
      presets.generic.eventName({
        method: "PUT",
        path: "/a/b",
        headers: {},
        body: "",
      })
    ).toBe("PUT /a/b");
  });
});
