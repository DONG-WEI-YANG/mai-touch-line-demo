import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../../../src/server/_core/context";
import { amenitiesRouter } from "../../../src/server/routers/amenities";
import { bookingsRouter } from "../../../src/server/routers/bookings";
import { workOrdersRouter } from "../../../src/server/routers/workOrders";
import * as db from "../../../src/server/db";

vi.mock("../../../src/server/db", () => ({
  getAmenityById: vi.fn(), getBookingsByAmenityAndDate: vi.fn(),
  createAmenity: vi.fn(), updateAmenity: vi.fn(), deleteAmenity: vi.fn(), getAllBookings: vi.fn(),
  getBookingById: vi.fn(), updateBookingStatus: vi.fn(),
  getWorkOrderById: vi.fn(), updateWorkOrder: vi.fn(), deleteWorkOrder: vi.fn(),
}));
const ctx = { user: { id: 1, role: "admin" } } as TrpcContext;
const amenities = amenitiesRouter.createCaller(ctx);
const bookings = bookingsRouter.createCaller(ctx);
const orders = workOrdersRouter.createCaller(ctx);
const amenity = { id: 1, name: "會議室", capacity: 1, isActive: true, openTime: "08:00", closeTime: "22:00", slotDurationMinutes: 60 };
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(db.getAmenityById).mockResolvedValue(amenity as never);
  vi.mocked(db.getBookingsByAmenityAndDate).mockResolvedValue([]);
  vi.mocked(db.getAllBookings).mockResolvedValue([]);
  vi.mocked(db.createAmenity).mockResolvedValue(1);
});

describe("property amenity management", () => {
  it.each([
    { name: "   " }, { capacity: 1.5 }, { slotDurationMinutes: 0 },
    { slotDurationMinutes: -30 }, { openTime: "25:00" },
    { openTime: "18:00", closeTime: "08:00" },
  ])("rejects invalid configuration %j", async (patch) => {
    await expect(amenities.create({ name: "會議室", ...patch })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.createAmenity).not.toHaveBeenCalled();
  });
  it("validates an edited time against the existing schedule", async () => {
    await expect(amenities.update({ id: 1, openTime: "23:00" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.updateAmenity).not.toHaveBeenCalled();
  });
  it("keeps booked amenities for history and asks staff to disable them", async () => {
    vi.mocked(db.getAllBookings).mockResolvedValue([{ amenityId: 1, status: "cancelled" }] as never);
    await expect(amenities.delete({ id: 1 })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(db.deleteAmenity).not.toHaveBeenCalled();
  });
  it("counts overlapping bookings in available slots", async () => {
    vi.mocked(db.getBookingsByAmenityAndDate).mockResolvedValue([{ startTime: "08:30", endTime: "09:30", guestCount: 1 }] as never);
    const slots = await amenities.getSlots({ amenityId: 1, date: "2099-12-31" });
    expect(slots.slice(0, 2).map((slot) => slot.available)).toEqual([false, false]);
  });
  it("offers no slots for disabled amenities", async () => {
    vi.mocked(db.getAmenityById).mockResolvedValue({ ...amenity, isActive: 0 } as never);
    await expect(amenities.getSlots({ amenityId: 1, date: "2099-12-31" })).resolves.toEqual([]);
  });
  it("does not permit residents to create facilities", async () => {
    const resident = amenitiesRouter.createCaller({ user: { id: 2, role: "resident" } } as TrpcContext);
    await expect(resident.create({ name: "會議室" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("property order management", () => {
  it("rejects missing bookings", async () => {
    await expect(bookings.updateStatus({ id: 99, status: "confirmed" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(db.updateBookingStatus).not.toHaveBeenCalled();
  });
  it("rechecks capacity when restoring a cancelled booking", async () => {
    vi.mocked(db.getBookingById).mockResolvedValue({ id: 2, amenityId: 1, date: "2099-12-31", startTime: "09:00", endTime: "10:00", guestCount: 1, status: "cancelled" } as never);
    vi.mocked(db.getBookingsByAmenityAndDate).mockResolvedValue([{ id: 3, startTime: "09:00", endTime: "10:00", guestCount: 1 }] as never);
    await expect(bookings.updateStatus({ id: 2, status: "confirmed" })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(db.updateBookingStatus).not.toHaveBeenCalled();
  });
  it("rejects updates and deletes for missing work orders", async () => {
    await expect(orders.update({ id: 99, status: "resolved" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(orders.delete({ id: 99 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(db.updateWorkOrder).not.toHaveBeenCalled();
    expect(db.deleteWorkOrder).not.toHaveBeenCalled();
  });
  it("clears resolution time when reopening a work order", async () => {
    vi.mocked(db.getWorkOrderById).mockResolvedValue({ id: 1, status: "resolved", resolvedAt: new Date() } as never);
    await orders.update({ id: 1, status: "in_progress" });
    expect(db.updateWorkOrder).toHaveBeenCalledWith(1, expect.objectContaining({ resolvedAt: null }));
  });
});
