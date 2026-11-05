import { beforeEach, expect, it, vi } from "vitest";
import { MongoServerError, type MongoClient } from "mongodb";
import { runTransaction } from "../src/lib/transaction.js";
import { ApiError } from "../src/lib/api-error.js";

const session = {
  startTransaction: vi.fn(),
  commitTransaction: vi.fn(),
  abortTransaction: vi.fn(),
  endSession: vi.fn(),
  inTransaction: vi.fn(),
};
const client = { startSession: () => session } as unknown as MongoClient;
function mongoError(label: string, code = 112) {
  return new MongoServerError({
    message: "Synthetic test failure",
    code,
    errorLabels: [label],
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  session.inTransaction.mockReturnValue(true);
  session.commitTransaction.mockResolvedValue(undefined);
  session.abortTransaction.mockResolvedValue(undefined);
  session.endSession.mockResolvedValue(undefined);
});

it("commits once and ends the session on success", async () => {
  expect(await runTransaction(client, async () => "saved")).toBe("saved");
  expect(session.startTransaction).toHaveBeenCalledWith({
    readConcern: { level: "snapshot" },
    writeConcern: { w: "majority" },
    maxCommitTimeMS: 5000,
  });
  expect(session.commitTransaction).toHaveBeenCalledTimes(1);
  expect(session.abortTransaction).not.toHaveBeenCalled();
  expect(session.endSession).toHaveBeenCalledTimes(1);
});
it("aborts a business rejection without retrying it", async () => {
  const work = vi
    .fn()
    .mockRejectedValue(new ApiError(409, "NOT_AVAILABLE", "No copies."));
  await expect(runTransaction(client, work)).rejects.toMatchObject({
    status: 409,
    code: "NOT_AVAILABLE",
  });
  expect(work).toHaveBeenCalledTimes(1);
  expect(session.abortTransaction).toHaveBeenCalledTimes(1);
  expect(session.commitTransaction).not.toHaveBeenCalled();
});
it("retries a transient abort and commits only the successful attempt", async () => {
  const work = vi
    .fn()
    .mockRejectedValueOnce(mongoError("TransientTransactionError"))
    .mockResolvedValue("saved");
  expect(await runTransaction(client, work)).toBe("saved");
  expect(work).toHaveBeenCalledTimes(2);
  expect(session.startTransaction).toHaveBeenCalledTimes(2);
  expect(session.abortTransaction).toHaveBeenCalledTimes(1);
});
it("caps transaction retries at three attempts", async () => {
  const work = vi
    .fn()
    .mockRejectedValue(mongoError("TransientTransactionError"));
  await expect(runTransaction(client, work)).rejects.toMatchObject({
    status: 409,
    code: "TRANSACTION_CONFLICT",
  });
  expect(work).toHaveBeenCalledTimes(3);
  expect(session.endSession).toHaveBeenCalledTimes(1);
});
it("retries only the same commit after an uncertain result", async () => {
  session.commitTransaction
    .mockRejectedValueOnce(mongoError("UnknownTransactionCommitResult", 91))
    .mockResolvedValue(undefined);
  const work = vi.fn().mockResolvedValue("saved");
  expect(await runTransaction(client, work)).toBe("saved");
  expect(work).toHaveBeenCalledTimes(1);
  expect(session.commitTransaction).toHaveBeenCalledTimes(2);
  expect(session.abortTransaction).not.toHaveBeenCalled();
});
it("caps uncertain commit retries and never replays or aborts the work", async () => {
  session.commitTransaction.mockRejectedValue(
    mongoError("UnknownTransactionCommitResult", 91),
  );
  const work = vi.fn().mockResolvedValue("saved");
  await expect(runTransaction(client, work)).rejects.toMatchObject({
    status: 503,
    code: "TRANSACTION_COMMIT_UNKNOWN",
  });
  expect(session.commitTransaction).toHaveBeenCalledTimes(3);
  expect(work).toHaveBeenCalledTimes(1);
  expect(session.abortTransaction).not.toHaveBeenCalled();
});
it("does not replay work when an uncertain commit later reports another error", async () => {
  session.commitTransaction
    .mockRejectedValueOnce(mongoError("UnknownTransactionCommitResult", 91))
    .mockRejectedValueOnce(mongoError("TransientTransactionError"));
  const work = vi.fn().mockResolvedValue("saved");
  await expect(runTransaction(client, work)).rejects.toMatchObject({
    code: "TRANSACTION_COMMIT_UNKNOWN",
  });
  expect(work).toHaveBeenCalledTimes(1);
  expect(session.commitTransaction).toHaveBeenCalledTimes(2);
  expect(session.abortTransaction).not.toHaveBeenCalled();
});
it("does not retry a commit that exceeded the server time limit", async () => {
  session.commitTransaction.mockRejectedValue(
    mongoError("UnknownTransactionCommitResult", 50),
  );
  await expect(
    runTransaction(client, async () => "saved"),
  ).rejects.toMatchObject({ code: "TRANSACTION_COMMIT_UNKNOWN" });
  expect(session.commitTransaction).toHaveBeenCalledTimes(1);
});
it("can restart a definitively aborted commit", async () => {
  session.commitTransaction
    .mockRejectedValueOnce(mongoError("TransientTransactionError"))
    .mockResolvedValue(undefined);
  const work = vi.fn().mockResolvedValue("saved");
  expect(await runTransaction(client, work)).toBe("saved");
  expect(work).toHaveBeenCalledTimes(2);
});
it("preserves the work error even if abort or cleanup fails", async () => {
  session.abortTransaction.mockRejectedValue(new Error("abort failed"));
  session.endSession.mockRejectedValue(new Error("cleanup failed"));
  await expect(
    runTransaction(client, async () => {
      throw new ApiError(403, "NOT_BORROWER", "Forbidden.");
    }),
  ).rejects.toMatchObject({ status: 403, code: "NOT_BORROWER" });
});
