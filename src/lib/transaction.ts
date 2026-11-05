import { setTimeout as delay } from "node:timers/promises";
import {
  MongoError,
  MongoServerError,
  type ClientSession,
  type MongoClient,
} from "mongodb";
import { ApiError } from "./api-error.js";

const MAX_ATTEMPTS = 3;
function hasLabel(error: unknown, label: string) {
  return error instanceof MongoError && error.hasErrorLabel(label);
}
function uncertainCommit() {
  return new ApiError(
    503,
    "TRANSACTION_COMMIT_UNKNOWN",
    "The result could not be confirmed. Refresh the library before retrying.",
  );
}

/** No external side effects in work: a confirmed transient abort may replay it. */
export async function runTransaction<T>(
  client: MongoClient,
  work: (session: ClientSession) => Promise<T>,
): Promise<T> {
  const session = client.startSession();
  try {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      let commitUncertain = false;
      try {
        session.startTransaction({
          readConcern: { level: "snapshot" },
          writeConcern: { w: "majority" },
          maxCommitTimeMS: 5000,
        });
        const result = await work(session);
        for (
          let commitAttempt = 1;
          commitAttempt <= MAX_ATTEMPTS;
          commitAttempt++
        ) {
          try {
            await session.commitTransaction();
            return result;
          } catch (error) {
            if (hasLabel(error, "UnknownTransactionCommitResult")) {
              commitUncertain = true;
              if (
                commitAttempt < MAX_ATTEMPTS &&
                !(error instanceof MongoServerError && error.code === 50)
              )
                continue;
            }
            // Once a commit outcome is unknown, never replay the stock mutation.
            if (commitUncertain) throw uncertainCommit();
            throw error;
          }
        }
      } catch (error) {
        if (commitUncertain) throw uncertainCommit();
        if (session.inTransaction())
          await session.abortTransaction().catch(() => undefined);
        if (!hasLabel(error, "TransientTransactionError")) throw error;
        if (attempt === MAX_ATTEMPTS)
          throw new ApiError(
            409,
            "TRANSACTION_CONFLICT",
            "The library changed at the same time. Refresh and try again.",
          );
        await delay(Math.floor(Math.random() * 25 * attempt));
      }
    }
    throw new ApiError(
      409,
      "TRANSACTION_CONFLICT",
      "Refresh the library and try again.",
    );
  } finally {
    // MongoDB 7.8 marks an attempted commit COMMITTED even if its outcome is
    // unknown, so ending this session does not abort/replay an uncertain commit.
    await session.endSession().catch(() => undefined);
  }
}
