import type Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { TRPCError } from '@trpc/server';
import { validateBookingWindow } from './bookingRules';
import { assertWithinCapacity, type BookingWindow } from '../_core/bookingCapacity';
export type DurableBookingInput={userId:number;amenityId:number;date:string;startTime:string;endTime:string;guestCount:number;notes?:string;requestId?:string};
export function createSqliteBooking(sqlite:Database.Database,input:DurableBookingInput) {
 const fingerprint=createHash('sha256').update(JSON.stringify([input.amenityId,input.date,input.startTime,input.endTime,input.guestCount,input.notes??null])).digest('hex');
 return sqlite.transaction(()=>{
  if(input.requestId) {
   const previous=sqlite.prepare('SELECT fingerprint,booking_id FROM booking_requests WHERE user_id=? AND request_id=?').get(input.userId,input.requestId) as {fingerprint:string;booking_id:number}|undefined;
   if(previous) {
    if(previous.fingerprint!==fingerprint)throw new TRPCError({code:'CONFLICT',message:'此請求編號已用於不同預約'});
    return previous.booking_id;
   }
  }
  const amenity=sqlite.prepare('SELECT * FROM amenities WHERE id=?').get(input.amenityId) as {isActive:number;capacity:number;openTime:string;closeTime:string;slotDurationMinutes:number}|undefined;
  if(!amenity)throw new TRPCError({code:'NOT_FOUND',message:'找不到設施'});
  if(!amenity.isActive)throw new TRPCError({code:'BAD_REQUEST',message:'設施已停用'});
  try {validateBookingWindow(input,amenity);}catch(error){throw new TRPCError({code:'BAD_REQUEST',message:(error as Error).message});}
  const existing=sqlite.prepare("SELECT startTime,endTime,guestCount FROM bookings WHERE amenityId=? AND date=? AND status='confirmed'").all(input.amenityId,input.date) as BookingWindow[];
  try {assertWithinCapacity({...input,capacity:amenity.capacity,existing});}catch(error){throw new TRPCError({code:'CONFLICT',message:(error as Error).message});}
  const result=sqlite.prepare('INSERT INTO bookings(userId,amenityId,date,startTime,endTime,guestCount,notes) VALUES(?,?,?,?,?,?,?)').run(input.userId,input.amenityId,input.date,input.startTime,input.endTime,input.guestCount,input.notes??null);
  const id=Number(result.lastInsertRowid);
  if(input.requestId)sqlite.prepare('INSERT INTO booking_requests(user_id,request_id,fingerprint,booking_id) VALUES(?,?,?,?)').run(input.userId,input.requestId,fingerprint,id);
  return id;
 }).immediate();
}
