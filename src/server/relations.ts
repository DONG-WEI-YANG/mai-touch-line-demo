import { relations } from "drizzle-orm";
import { users, amenities, bookings, workOrders, chatMessages } from "./schema";

export const usersRelations = relations(users, ({ many }) => ({
  bookings: many(bookings),
  workOrders: many(workOrders),
  chatMessages: many(chatMessages),
}));

export const amenitiesRelations = relations(amenities, ({ many }) => ({
  bookings: many(bookings),
}));

export const bookingsRelations = relations(bookings, ({ one }) => ({
  user: one(users, { fields: [bookings.userId], references: [users.id] }),
  amenity: one(amenities, { fields: [bookings.amenityId], references: [amenities.id] }),
}));

export const workOrdersRelations = relations(workOrders, ({ one }) => ({
  user: one(users, { fields: [workOrders.userId], references: [users.id] }),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  user: one(users, { fields: [chatMessages.userId], references: [users.id] }),
}));
