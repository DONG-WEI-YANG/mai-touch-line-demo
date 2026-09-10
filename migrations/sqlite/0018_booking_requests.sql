CREATE TABLE IF NOT EXISTS booking_requests (
 user_id INTEGER NOT NULL, request_id TEXT NOT NULL, fingerprint TEXT NOT NULL,
 booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
 PRIMARY KEY(user_id,request_id)
);
CREATE TRIGGER IF NOT EXISTS booking_capacity_insert BEFORE INSERT ON bookings
WHEN NEW.status='confirmed' BEGIN
 SELECT CASE WHEN NEW.guestCount + COALESCE((
  SELECT MAX((SELECT COALESCE(SUM(b.guestCount),0) FROM bookings b
   WHERE b.amenityId=NEW.amenityId AND b.date=NEW.date AND b.status='confirmed'
   AND b.startTime<=points.t AND b.endTime>points.t))
  FROM (SELECT NEW.startTime AS t UNION SELECT startTime FROM bookings
   WHERE amenityId=NEW.amenityId AND date=NEW.date AND status='confirmed'
   AND startTime>=NEW.startTime AND startTime<NEW.endTime) points
 ),0) > (SELECT capacity FROM amenities WHERE id=NEW.amenityId)
 THEN RAISE(ABORT,'Booking capacity exceeded') END;
END;
CREATE TRIGGER IF NOT EXISTS booking_capacity_update BEFORE UPDATE OF status,guestCount,startTime,endTime,amenityId,date ON bookings
WHEN NEW.status='confirmed' BEGIN
 SELECT CASE WHEN NEW.guestCount + COALESCE((
  SELECT MAX((SELECT COALESCE(SUM(b.guestCount),0) FROM bookings b
   WHERE b.amenityId=NEW.amenityId AND b.date=NEW.date AND b.status='confirmed'
   AND b.startTime<=points.t AND b.endTime>points.t AND b.id<>NEW.id))
  FROM (SELECT NEW.startTime AS t UNION SELECT startTime FROM bookings
   WHERE amenityId=NEW.amenityId AND date=NEW.date AND status='confirmed'
   AND startTime>=NEW.startTime AND startTime<NEW.endTime) points
 ),0) > (SELECT capacity FROM amenities WHERE id=NEW.amenityId)
 THEN RAISE(ABORT,'Booking capacity exceeded') END;
END;
