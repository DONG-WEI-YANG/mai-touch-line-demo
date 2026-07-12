import { TimeSlot, Amenity, Booking } from "./types";

// Helper to generate time slots for the next 7 days
function generateSlots(startHour: number, endHour: number, durationHours: number): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const today = new Date();

  for (let d = 0; d < 7; d++) {
    const date = new Date(today);
    date.setDate(today.getDate() + d);
    const dateStr = date.toISOString().split("T")[0];

    for (let h = startHour; h + durationHours <= endHour; h += durationHours) {
      const startTime = `${h.toString().padStart(2, "0")}:00`;
      const end = h + durationHours;
      const endTime = `${end.toString().padStart(2, "0")}:00`;
      slots.push({
        id: `${dateStr}-${startTime}`,
        date: dateStr,
        startTime,
        endTime,
        // Randomly mark some as unavailable for realism
        available: Math.random() > 0.25,
      });
    }
  }
  return slots;
}

export const AMENITIES: Amenity[] = [
  {
    id: "am-1",
    name: "Private Dining Room",
    description:
      "An exclusive dining space with a chef's table seating up to 12 guests. Features a curated wine wall, ambient lighting controls, and a dedicated service entrance for discreet hosting.",
    icon: "fork.knife",
    location: "Level 3, East Wing",
    capacity: 12,
    rules: [
      "Advance booking required (minimum 24 hours)",
      "Catering must be arranged through the concierge",
      "Maximum duration: 4 hours per session",
      "Complimentary for Black tier members",
    ],
    availableSlots: generateSlots(11, 22, 2),
    imageColor: "#C4A882",
  },
  {
    id: "am-2",
    name: "Sky Infinity Pool",
    description:
      "Temperature-controlled infinity pool overlooking the city skyline. Includes private cabanas, professional towel service, and a poolside refreshment bar.",
    icon: "waves",
    location: "Rooftop Terrace",
    capacity: 25,
    rules: [
      "Resident guests must be accompanied at all times",
      "Shower before entering the pool",
      "No glassware permitted on the pool deck",
      "Priority booking for Diamond and Black tier members",
    ],
    availableSlots: generateSlots(6, 22, 1),
    imageColor: "#4A90E2",
  },
  {
    id: "am-3",
    name: "Private Cinema",
    description:
      "State-of-the-art screening room with Dolby Atmos sound and reclining leather seating. Pre-configured with major streaming platforms and a professional library.",
    icon: "tv",
    location: "Level 1, Entertainment Zone",
    capacity: 8,
    rules: [
      "Booking duration: 2 - 4 hours",
      "No external food or beverages",
      "Cancellation required 6 hours in advance",
    ],
    availableSlots: generateSlots(10, 23, 2),
    imageColor: "#E74C3C",
  },
  {
    id: "am-4",
    name: "Wellness Spa & Sauna",
    description:
      "A serene escape featuring Himalayan salt sauna, eucalyptus steam room, and private massage suites. Attendant available for personalized aromatherapy setup.",
    icon: "dumbbell.fill",
    location: "Level 2, Wellness Center",
    capacity: 4,
    rules: [
      "Adults only (18+)",
      "Quiet zone - please keep voices to a whisper",
      "Maximum 60 minutes per session",
    ],
    availableSlots: generateSlots(8, 21, 1),
    imageColor: "#27AE60",
  },
];

export const SAMPLE_BOOKINGS: Booking[] = [
  {
    id: "b-1",
    amenityId: "am-1",
    amenityName: "Private Dining Room",
    amenityIcon: "fork.knife",
    date: new Date().toISOString().split("T")[0],
    startTime: "19:00",
    endTime: "21:00",
    status: "confirmed",
    createdAt: Date.now() - 86400000,
    guestCount: 6,
    notes: "Birthday celebration, please arrange for flowers.",
  },
];

export function formatDateDisplay(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function getDayLabel(dateStr: string): string {
  // Compare on the SAME basis getNext7Days produces its date strings
  // (toISOString → UTC calendar date). The previous version parsed the input as
  // a LOCAL date and compared to a LOCAL "today", so in any non-UTC timezone the
  // UTC date strings from getNext7Days never matched "today"/"tomorrow" (audit
  // timezone finding — the getDayLabel tests failed for exactly this reason).
  const todayStr = new Date().toISOString().split("T")[0];
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  if (dateStr === todayStr) return "Today";
  if (dateStr === tomorrowStr) return "Tomorrow";

  return new Date(dateStr + "T00:00:00Z").toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
}

export function getNext7Days(): string[] {
  const days: string[] = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d.toISOString().split("T")[0]);
  }
  return days;
}

export function formatTimeRange(start: string, end: string): string {
  return `${start} – ${end}`;
}
