import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    // Valores ficticios: las pruebas unitarias no hablan con Supabase.
    env: { NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key" },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
