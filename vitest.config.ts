import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    projects: [
      { test: { name: "unit", include: ["tests/**/*.test.ts"] } },
      {
        test: {
          name: "live",
          include: ["tests/**/*.live.ts"],
          testTimeout: 40000,
        },
      },
    ],
  },
});
