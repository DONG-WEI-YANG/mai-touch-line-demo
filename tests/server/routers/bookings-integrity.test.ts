import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../../../src/server/_core/context";
import { bookingsRouter } from "../../../src/server/routers/bookings";
import * as db from "../../../src/server/db";
import { createCheckedBooking } from "../../../src/server/services/bookingService";

vi.mock("../../../src/server/db", () => ({
  getAmenityById: vi.fn(), getBookingsByAmenityAndDate: vi.fn(),
  createBooking: vi.fn(), getBookingById: vi.fn(), updateBookingStatus: vi.fn(),
}));

const caller = bookingsRouter.createCaller({ user: { id: 1, role: "resident" } } as TrpcContext);
const input = { amenityId: 1, date: "2099-12-31", startTime: "09:00", endTime: "11:00", guestCount: 1 };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(db.getAmenityById).mockResolvedValue({ id: 1, isActive: true, capacity: 1 } as NonNullable<Awaited<ReturnType<typeof db.getAmenityById>>>);
  vi.mocked(db.getBookingsByAmenityAndDate).mockResolvedValue([]);
  vi.mocked(db.createBooking).mockResolvedValue(1);
});

describe("booking integrity", () => {
  it("rechecks completion inside the lock before resident cancellation", async () => {
    vi.mocked(db.getBookingById)
      .mockResolvedValueOnce({ ...input, id: 7, userId: 1, status: "confirmed" } as never)
      .mockResolvedValueOnce({ ...input, id: 7, userId: 1, status: "confirmed" } as never)
      .mockResolvedValue({ ...input, id: 7, userId: 1, status: "completed" } as never);
    await expect(caller.cancel({ id: 7 })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(db.updateBookingStatus).not.toHaveBeenCalled();
  });
  it("allows residents to cancel pending bookings", async () => {
    vi.mocked(db.getBookingById).mockResolvedValue({ ...input, id: 7, userId: 1, status: "pending" } as never);
    await caller.cancel({ id: 7 });
    expect(db.updateBookingStatus).toHaveBeenCalledWith(7, "cancelled");
  });
  it("rejects cancellation of another resident's booking", async () => {
    vi.mocked(db.getBookingById).mockResolvedValue({ ...input, id: 7, userId: 2, status: "confirmed" } as never);
    await expect(caller.cancel({ id: 7 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.updateBookingStatus).not.toHaveBeenCalled();
  });
  it("does not allow residents to cancel completed bookings", async () => {
    vi.mocked(db.getBookingById).mockResolvedValue({ ...input, id: 7, userId: 1, status: "completed" } as never);
    await expect(caller.cancel({ id: 7 })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(db.updateBookingStatus).not.toHaveBeenCalled();
  });
  it("treats an already cancelled booking as an idempotent success", async () => {
    vi.mocked(db.getBookingById).mockResolvedValue({ ...input, id: 7, userId: 1, status: "cancelled" } as never);
    await expect(caller.cancel({ id: 7 })).resolves.toBeUndefined();
    expect(db.updateBookingStatus).not.toHaveBeenCalled();
  });
  it.each([false, 0])("rejects a disabled amenity (%s) without writing", async (isActive) => {
    vi.mocked(db.getAmenityById).mockResolvedValue({ id: 1, isActive, capacity: 1 } as NonNullable<Awaited<ReturnType<typeof db.getAmenityById>>>);
    await expect(caller.create(input)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.createBooking).not.toHaveBeenCalled();
  });

  it.each(["api", "voice writer"])("serializes API requests against %s with different start times", async (path) => {
    const saved: typeof input[] = [];
    vi.mocked(db.getBookingsByAmenityAndDate).mockImplementation(async () => [...saved] as Awaited<ReturnType<typeof db.getBookingsByAmenityAndDate>>);
    vi.mocked(db.createBooking).mockImplementation(async (booking) => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      saved.push(booking as typeof input);
      return saved.length;
    });
    const results = await Promise.allSettled([
      caller.create(input), path === "api"
        ? caller.create({ ...input, startTime: "10:00", endTime: "12:00" })
        : createCheckedBooking({ ...input, userId: 2, startTime: "10:00", endTime: "12:00" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    expect(saved).toHaveLength(1);
  });

  it("allows adjacent bookings", async () => {
    vi.mocked(db.getBookingsByAmenityAndDate).mockResolvedValue([input] as Awaited<ReturnType<typeof db.getBookingsByAmenityAndDate>>);
    await expect(caller.create({ ...input, startTime: "11:00", endTime: "12:00" })).resolves.toBe(1);
  });
});
