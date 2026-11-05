import { MongoClient } from "mongodb";
import { parseMongoEnv } from "./env.js";

let client: MongoClient | undefined;

// A MongoClient owns a pool. The driver connects lazily and coordinates concurrent
// connection attempts; creating a client per request would create extra pools.
export function getMongoClient(): MongoClient {
  if (!client) {
    const config = parseMongoEnv(process.env);
    try {
      client = new MongoClient(config.MONGODB_URI, {
        appName: "BookBar API",
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
      });
    } catch {
      throw new Error("Invalid MongoDB connection settings. Check your private environment file.");
    }
  }
  return client;
}

export function getDatabase() {
  return getMongoClient().db(parseMongoEnv(process.env).MONGODB_DB_NAME);
}

export async function closeDatabase() {
  const current = client;
  client = undefined;
  await current?.close();
}
