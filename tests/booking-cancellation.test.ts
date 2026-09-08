import { describe, expect, it, vi } from "vitest";
import { cancelBooking } from "../src/lib/booking-cancellation";

function dependencies(online = true) {
  return { isOnline: () => online, cancel: vi.fn().mockResolvedValue(undefined), queue: vi.fn().mockResolvedValue(undefined) };
}
describe("resident cancellation delivery", () => {
  it("reports confirmation only after the server accepts", async () => {
    const deps = dependencies();
    await expect(cancelBooking(7, deps)).resolves.toBe("confirmed");
    expect(deps.cancel).toHaveBeenCalledWith(7);
    expect(deps.queue).not.toHaveBeenCalled();
  });
  it("queues offline requests without claiming cancellation", async () => {
    const deps = dependencies(false);
    await expect(cancelBooking(7, deps)).resolves.toBe("queued");
    expect(deps.cancel).not.toHaveBeenCalled();
    expect(deps.queue).toHaveBeenCalledWith(7);
  });
  it("propagates offline storage failure", async () => {
    const deps = dependencies(false);
    deps.queue.mockRejectedValue(new Error("storage full"));
    await expect(cancelBooking(7, deps)).rejects.toThrow("storage full");
  });
  it("queues transport failure wrapped by tRPC", async () => {
    const deps = dependencies();
    deps.cancel.mockRejectedValue({ message: "fetch failed", cause: new TypeError("Failed to fetch") });
    await expect(cancelBooking(7, deps)).resolves.toBe("queued");
  });
  it.each([403, 404, 409, 500])("does not queue a server rejection (%s)", async (httpStatus) => {
    const deps = dependencies();
    const error = { message: "network policy rejected request", data: { httpStatus } };
    deps.cancel.mockRejectedValue(error);
    await expect(cancelBooking(7, deps)).rejects.toBe(error);
    expect(deps.queue).not.toHaveBeenCalled();
  });
});
