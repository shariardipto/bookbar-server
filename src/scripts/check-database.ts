import dotenv from "dotenv";
import { closeDatabase, getDatabase, getMongoClient } from "../config/database.js";
import { checkDatabase } from "../config/database-checks.js";

dotenv.config({ quiet: true });

try {
  if (!process.env.MONGODB_URI?.trim()) {
    console.error("BLOCKED_MANUAL: set MONGODB_URI in the private server .env (MANUAL-MONGO-01).");
    process.exitCode = 2;
  } else {
    const checks = await checkDatabase(getMongoClient(), getDatabase());
    for (const check of checks) console.log(`PASS: ${check}`);
  }
} catch (error) {
  const code = typeof error === "object" && error !== null && "code" in error && typeof error.code === "number" ? error.code : undefined;
  const schemaReview = typeof error === "object" && error !== null && "code" in error && error.code === "SCHEMA_REVIEW_REQUIRED";
  console.error(schemaReview ? "FAIL: existing collection validation differs. Review it before updating; nothing was overwritten." : code === 11000
    ? "FAIL: existing duplicate records prevent the unique loan index. Review them; no records were deleted."
    : `FAIL: database checks did not complete${code ? ` (MongoDB code ${code})` : ""}. Verify private settings, permissions, network access, and transaction support.`);
  process.exitCode = 1;
} finally {
  await closeDatabase().catch(() => { process.exitCode = 1; });
}
