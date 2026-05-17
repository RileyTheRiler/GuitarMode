import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["lib/**/*.ts"],
      exclude: ["**/*.test.ts", "lib/audio/use*.ts"],
    },
  },
  resolve: {
    alias: {
      "@": "/home/user/GuitarMode",
    },
  },
});
