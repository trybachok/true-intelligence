import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  input: "../contracts/openapi.yaml",
  output: "app/api-client",
  plugins: [
    { name: "@hey-api/client-fetch", runtimeConfigPath: "./app/api-config" },
    "@hey-api/typescript",
    "@hey-api/sdk",
  ],
});
