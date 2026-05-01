// Context utilities used by consuming modules

import type { WorkOrder, ResidentProfile, QuickAction, ServiceItem } from "./types";

// Quick actions for the home screen
export const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "1",
    label: "Prepare Apartment",
    prompt: "Please prepare my apartment — lights, temperature, and ambiance.",
    icon: "house.fill",
  },
  {
    id: "2",
    label: "Guest Arriving",
    prompt: "Guest arriving tomorrow, make it seamless.",
    icon: "hand.wave.fill",
  },
  {
    id: "3",
    label: "Privacy Mode",
    prompt: "Enable privacy mode for the evening.",
    icon: "eye.slash.fill",
  },
  {
    id: "4",
    label: "Noise Issue",
    prompt: "Neighbors are loud again, can you handle it discreetly?",
    icon: "megaphone.fill",
  },
  {
    id: "5",
    label: "Book Amenity",
    prompt: "I'd like to book the private dining room for this weekend.",
    icon: "fork.knife",
  },
  {
    id: "6",
    label: "Maintenance",
    prompt: "I need maintenance for a plumbing issue in the master bathroom.",
    icon: "wrench.fill",
  },
];

// Service items
export const SERVICES: ServiceItem[] = [
  // Property Operations
  {
    id: "op-1",
    title: "Zero-Friction Task Delegation",
    description: "Assign tasks via voice without needing to learn complex management apps.",
    icon: "bolt.fill",
    category: "operations",
  },
  {
    id: "op-2",
    title: "Automated Management Pressure",
    description: "AI automatically issues warnings and tracks repair deadlines to ensure staff accountability.",
    icon: "clock.fill",
    category: "operations",
  },
  {
    id: "op-3",
    title: "Elegant Social Mediation",
    description: "Resolves neighbor disputes using community rules to protect your public image.",
    icon: "person.2.fill",
    category: "operations",
  },
  // Lifestyle Experience
  {
    id: "lf-1",
    title: "Predictive Space Control",
    description: "Elevators are pre-summoned or locked in 'Privacy Mode' based on your schedule.",
    icon: "elevator",
    category: "lifestyle",
  },
  {
    id: "lf-2",
    title: "Invisible VIP Hosting",
    description: "Provides 'touchless' entry and low-profile guidance for private guests and consultants.",
    icon: "eye.slash.fill",
    category: "lifestyle",
  },
  {
    id: "lf-3",
    title: "Dynamic Lifestyle Curation",
    description: "Manages banquet planning, amenity booking, and custom catering with a single command.",
    icon: "sparkles",
    category: "lifestyle",
  },
];

// Sample work orders
export const SAMPLE_WORK_ORDERS: WorkOrder[] = [
  {
    id: "wo-1",
    type: "concierge",
    title: "Private Dining Reservation",
    description: "Reserve the private dining room for Saturday evening, 8 guests, wine pairing menu.",
    status: "in_progress",
    createdAt: Date.now() - 3600000,
    updatedAt: Date.now() - 1800000,
    priority: "medium",
  },
  {
    id: "wo-2",
    type: "maintenance",
    title: "HVAC Filter Replacement",
    description: "Scheduled quarterly HVAC filter replacement for Unit 42A.",
    status: "pending",
    createdAt: Date.now() - 7200000,
    updatedAt: Date.now() - 7200000,
    priority: "low",
  },
  {
    id: "wo-3",
    type: "security",
    title: "Guest Access — Dr. Chen",
    description: "Touchless entry configured for Dr. Chen, arriving Tuesday 2:00 PM. Discrete elevator routing enabled.",
    status: "completed",
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 43200000,
    priority: "high",
  },
  {
    id: "wo-4",
    type: "maintenance",
    title: "Lobby Lighting Adjustment",
    description: "Dimming schedule updated for evening ambiance per resident council request.",
    status: "completed",
    createdAt: Date.now() - 172800000,
    updatedAt: Date.now() - 86400000,
    priority: "low",
  },
  {
    id: "wo-5",
    type: "concierge",
    title: "Spa & Sauna Preparation",
    description: "Pre-heat sauna and prepare spa amenities for 7:00 PM arrival.",
    status: "in_progress",
    createdAt: Date.now() - 5400000,
    updatedAt: Date.now() - 2700000,
    priority: "high",
  },
];

// Default resident profile
export const DEFAULT_PROFILE: ResidentProfile = {
  name: "Alexander Whitmore",
  unit: "Penthouse 42A",
  tier: "Black",
};

// AI response templates
export const AI_RESPONSES: Record<string, string> = {
  "prepare apartment": "Understood. I'm preparing your apartment now:\n\n• Ambient lighting set to Evening Relaxation\n• Temperature adjusted to 22°C\n• Blackout curtains at 80%\n• Background music: Lo-fi Jazz\n\nEverything will be ready in approximately 3 minutes.",
  "guest arriving": "I'll arrange everything for your guest's arrival:\n\n• Touchless entry pass generated\n• Elevator pre-routed to private lobby\n• Guest suite temperature set to 21°C\n• Welcome amenities prepared\n• Concierge briefed on dietary preferences\n\nShall I send the digital access pass to your guest?",
  "privacy mode": "Privacy Mode activated:\n\n• Elevator locked to private access only\n• Lobby staff notified — no visitor announcements\n• Smart glass opacity set to maximum\n• Noise monitoring paused for your floor\n\nPrivacy Mode will remain active until you deactivate it.",
  "noise": "I understand the situation. Handling this discreetly:\n\n• Checking community quiet hours policy\n• Sending a courteous automated reminder to the neighboring unit\n• No personal identification will be disclosed\n• Follow-up monitoring enabled for the next 2 hours\n\nYour privacy and reputation are fully protected.",
  "book": "I'd be happy to arrange that for you:\n\n• Checking availability for the private dining room\n• Saturday evening slot confirmed: 7:00 PM – 11:00 PM\n• Chef's tasting menu with wine pairing selected\n• Table setting for your preferred arrangement\n\nShall I add any special requests for the evening?",
  "maintenance": "I've logged your maintenance request:\n\n• Work order created: Priority High\n• Maintenance team notified\n• Estimated response time: Within 2 hours\n• I'll track progress and update you\n\nIs there anything else you need in the meantime?",
  "default": "I've analyzed your request and I'm working on it now. The Digital Brain is processing the following:\n\n• Tune Analysis: Understanding context and priority\n• Regulations Check: Verifying against community policies\n• Generating Work Orders: Coordinating with relevant teams\n\nI'll keep you updated on the progress.",
};

export function getAIResponse(userMessage: string): string {
  const lower = userMessage.toLowerCase();
  for (const [key, response] of Object.entries(AI_RESPONSES)) {
    if (key === "default") continue;
    if (lower.includes(key)) return response;
  }
  return AI_RESPONSES["default"];
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
