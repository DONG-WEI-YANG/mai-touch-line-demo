/**
 * Database Initialization Script
 * 初始化數據庫並創建示例數據
 */

import { dbManager } from '../src/server/database/adapter';
import { runMigrations } from '../src/server/database/migrate';
import * as db from '../src/server/db';

async function initializeDatabase() {
  console.log('='.repeat(50));
  console.log('m\'AI Touch - Database Initialization');
  console.log('='.repeat(50));
  console.log('');

  try {
    // 1. 連接數據庫
    console.log('[1/4] Connecting to database...');
    const adapter = await dbManager.connect();
    console.log(`✓ Connected to ${adapter.type} database`);
    console.log('');

    // 2. 運行遷移
    console.log('[2/4] Running migrations...');
    await runMigrations();
    console.log('✓ Migrations completed');
    console.log('');

    // 3. 創建示例數據
    console.log('[3/4] Creating sample data...');
    await createSampleData();
    console.log('✓ Sample data created');
    console.log('');

    // 4. 驗證數據
    console.log('[4/4] Verifying data...');
    await verifyData();
    console.log('✓ Data verification completed');
    console.log('');

    console.log('='.repeat(50));
    console.log('✅ Database initialization completed successfully!');
    console.log('='.repeat(50));
    console.log('');
    console.log('You can now start the server with: npm run server');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('='.repeat(50));
    console.error('❌ Database initialization failed!');
    console.error('='.repeat(50));
    console.error('');
    console.error('Error:', error);
    console.error('');
    process.exit(1);
  } finally {
    await dbManager.close();
  }
}

async function createSampleData() {
  // 創建示例用戶
  console.log('  Creating sample users...');
  await db.upsertUser({
    openId: 'demo-user-001',
    name: 'Alexander Whitmore',
    email: 'alexander@example.com',
    loginMethod: 'demo',
    role: 'admin',
  });

  await db.upsertUser({
    openId: 'demo-user-002',
    name: 'Victoria Chen',
    email: 'victoria@example.com',
    loginMethod: 'demo',
          role: 'resident',  });

  console.log('  ✓ Created 2 sample users');

  // 創建示例設施
  console.log('  Creating sample amenities...');
  
  const amenityIds: number[] = [];

  amenityIds.push(await db.createAmenity({
    name: 'Private Dining Room',
    description: 'An exclusive dining space with a chef\'s table seating up to 12 guests.',
    icon: 'fork.knife',
    category: 'dining',
    capacity: 12,
    location: 'Level 3, East Wing',
    rules: 'Advance booking required (minimum 24 hours)',
    openTime: '11:00',
    closeTime: '22:00',
    slotDurationMinutes: 120,
  }));

  amenityIds.push(await db.createAmenity({
    name: 'Infinity Pool',
    description: 'Rooftop infinity pool with panoramic city views.',
    icon: 'water',
    category: 'recreation',
    capacity: 20,
    location: 'Rooftop, Level 42',
    rules: 'Pool hours: 6:00 AM - 10:00 PM',
    openTime: '06:00',
    closeTime: '22:00',
    slotDurationMinutes: 60,
  }));

  amenityIds.push(await db.createAmenity({
    name: 'Wellness Spa',
    description: 'Full-service spa with massage rooms and sauna.',
    icon: 'spa',
    category: 'wellness',
    capacity: 8,
    location: 'Level 2, West Wing',
    rules: 'Appointments required',
    openTime: '08:00',
    closeTime: '21:00',
    slotDurationMinutes: 90,
  }));

  amenityIds.push(await db.createAmenity({
    name: 'Private Cinema',
    description: '20-seat private cinema with 4K projection and Dolby Atmos.',
    icon: 'film',
    category: 'entertainment',
    capacity: 20,
    location: 'Level 1, Entertainment Wing',
    rules: 'Minimum 2 hours booking',
    openTime: '10:00',
    closeTime: '23:00',
    slotDurationMinutes: 120,
  }));

  amenityIds.push(await db.createAmenity({
    name: 'Fitness Center',
    description: 'State-of-the-art gym with personal training available.',
    icon: 'dumbbell',
    category: 'wellness',
    capacity: 30,
    location: 'Level 2, Fitness Wing',
    rules: '24/7 access for residents',
    openTime: '00:00',
    closeTime: '23:59',
    slotDurationMinutes: 60,
  }));

  console.log(`  ✓ Created ${amenityIds.length} sample amenities`);

  // 創建示例預約
  console.log('  Creating sample bookings...');
  
  const users = await db.getAllUsers();
  if (users.length > 0 && amenityIds.length > 0) {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    await db.createBooking({
      userId: users[0].id,
      amenityId: amenityIds[0],
      date: tomorrow.toISOString().split('T')[0],
      startTime: '19:00',
      endTime: '21:00',
      guestCount: 8,
      notes: 'Anniversary dinner',
      status: 'confirmed',
    });

    console.log('  ✓ Created 1 sample booking');
  }

  // 創建示例工作訂單
  console.log('  Creating sample work orders...');
  
  if (users.length > 0) {
    await db.createWorkOrder({
      userId: users[0].id,
      title: 'HVAC Filter Replacement',
      description: 'Scheduled quarterly HVAC filter replacement',
      category: 'maintenance',
      priority: 'low',
      status: 'open',
    });

    console.log('  ✓ Created 1 sample work order');
  }
}

async function verifyData() {
  const userCount = await db.getUserCount();
  const amenityCount = (await db.getAllAmenities()).length;
  const bookingCount = await db.getBookingCount();
  const workOrderCount = await db.getWorkOrderCount();

  console.log(`  Users: ${userCount}`);
  console.log(`  Amenities: ${amenityCount}`);
  console.log(`  Bookings: ${bookingCount}`);
  console.log(`  Work Orders: ${workOrderCount}`);
}

// 運行初始化
if (require.main === module) {
  initializeDatabase();
}

export { initializeDatabase };