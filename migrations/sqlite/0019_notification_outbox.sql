CREATE TABLE IF NOT EXISTS notification_outbox (
 id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
 kind TEXT NOT NULL, entity_id INTEGER NOT NULL, user_id INTEGER NOT NULL,
 payload TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
 available_at INTEGER NOT NULL DEFAULT (unixepoch()*1000),
 lease_until INTEGER NOT NULL DEFAULT 0, lease_token TEXT,
 delivered_at INTEGER, last_error TEXT, created_at INTEGER NOT NULL DEFAULT (unixepoch()*1000)
);
CREATE INDEX IF NOT EXISTS notification_outbox_pending ON notification_outbox(delivered_at,available_at,lease_until);
CREATE TRIGGER IF NOT EXISTS booking_created_outbox AFTER INSERT ON bookings BEGIN
 INSERT INTO notification_outbox(kind,entity_id,user_id,payload) VALUES('booking.created',NEW.id,NEW.userId,json_object('status',NEW.status,'amenityId',NEW.amenityId,'date',NEW.date,'startTime',NEW.startTime));
END;
CREATE TRIGGER IF NOT EXISTS booking_status_outbox AFTER UPDATE OF status ON bookings WHEN OLD.status<>NEW.status BEGIN
 INSERT INTO notification_outbox(kind,entity_id,user_id,payload) VALUES('booking.status',NEW.id,NEW.userId,json_object('status',NEW.status));
END;
CREATE TRIGGER IF NOT EXISTS work_order_created_outbox AFTER INSERT ON work_orders BEGIN
 INSERT INTO notification_outbox(kind,entity_id,user_id,payload) VALUES('work_order.created',NEW.id,NEW.userId,json_object('status',NEW.status,'title',NEW.title,'description',NEW.description,'category',NEW.category));
END;
CREATE TRIGGER IF NOT EXISTS work_order_status_outbox AFTER UPDATE OF status ON work_orders WHEN OLD.status<>NEW.status BEGIN
 INSERT INTO notification_outbox(kind,entity_id,user_id,payload) VALUES('work_order.status',NEW.id,NEW.userId,json_object('status',NEW.status,'title',NEW.title));
END;
CREATE TABLE IF NOT EXISTS notification_deliveries (
 event_id TEXT NOT NULL REFERENCES notification_outbox(id) ON DELETE CASCADE,
 recipient TEXT NOT NULL, retry_key TEXT NOT NULL, message TEXT NOT NULL,
 delivered_at INTEGER, PRIMARY KEY(event_id,recipient)
);
