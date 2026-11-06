import { defineConfig } from "oxlint";
import antiSlop from "ultracite/oxlint/anti-slop";
import core from "ultracite/oxlint/core";
import react from "ultracite/oxlint/react";
import shadcn from "ultracite/oxlint/shadcn";
import tanstack from "ultracite/oxlint/tanstack";

export default defineConfig({
  extends: [core, react, tanstack, shadcn, antiSlop],
  ignorePatterns: [
    ...(core.ignorePatterns ?? []),
    "src/routeTree.gen.ts",
    "src/components/ui/**",
    "src/hooks/**",
  ],
  jsPlugins: shadcn.jsPlugins,
  overrides: [
    {
      files: ["**"],
      rules: {
        "func-style": "off",
        "no-await-in-loop": "off",
        "no-inner-declarations": "off",
        "no-param-reassign": "off",
        "class-methods-use-this": "off",
        "typescript/consistent-return": "off",
        "typescript/strict-boolean-expressions": "off",
        "typescript/no-non-null-assertion": "off",
        "unicorn/no-await-expression-member": "off",
        "unicorn/consistent-function-scoping": "off",
        "react/function-component-definition": "off",
        "no-use-before-define": "off",
        "no-confusing-void-expression": "off",
      },
    },
  ],
});
