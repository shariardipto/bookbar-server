import dotenv from "dotenv";
import { createApp } from "./app.js";
import { parseEnv } from "./config/env.js";
import { closeDatabase } from "./config/database.js";

dotenv.config({ quiet: true });

const env = parseEnv(process.env);
const server = createApp(env).listen(env.PORT, () => {
  console.info(`BookBar API listening at http://localhost:${env.PORT}`);
  console.info("P00 baseline: GET /books returns 503 until the catalog is implemented.");
});

server.on("error", () => {
  console.error("BookBar API could not start. Check PORT and local port availability.");
  process.exitCode = 1;
});

function shutdown() {
  server.close(async () => {
    try {
      await closeDatabase();
      process.exitCode = 0;
    } catch {
      console.error("BookBar could not close its database connection cleanly.");
      process.exitCode = 1;
    }
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
