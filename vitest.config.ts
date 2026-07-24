import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Tests unitarios de lógica pura (invariantes de seguridad y marca por tenant).
// El aislamiento multi-tenant a nivel RLS se verifica contra la BD por separado
// (simulación de JWT por rol en transacción revertida), no en CI.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
