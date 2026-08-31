import { createMockRuntime } from "./app.js";

const port = Number(process.env.PORT) || 3001;
const runtime = createMockRuntime();
const server = runtime.createHttpServer();

server.listen(port, () => {
  console.log(`Mock API listening on http://localhost:${port} (scenario: ${runtime.contracts.scenarioName})`);
});

server.on("error", (error) => {
  console.error("Failed to start mock API:", error);
  process.exitCode = 1;
});
