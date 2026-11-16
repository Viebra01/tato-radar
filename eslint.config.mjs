import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
export default tseslint.config(
  { ignores: ["dist/**", "outputs/**", "work/**"] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["tests/*.mjs"],
    languageOptions: {
      globals: Object.fromEntries(
        [
          "process",
          "chrome",
          "indexedDB",
          "document",
          "setTimeout",
          "console",
          "innerWidth",
          "getComputedStyle",
          "URL",
          "location",
        ].map((name) => [name, "readonly"]),
      ),
    },
  },
);
