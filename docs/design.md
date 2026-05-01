# m'AI Touch - Design Document

## App Concept
m'AI Touch: The Digital Brain for Elite Living — An AI-powered luxury property management and concierge mobile application. Residents interact with a "Digital Brain" using natural language (text/voice) to manage their living space, delegate tasks, and access premium lifestyle services.

## Color Palette

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| primary | #B8977E | #C4A882 | Gold/champagne accent — luxury brand color |
| background | #FAFAF8 | #1A1A1A | Warm off-white / deep black |
| surface | #F5F3EF | #242424 | Cards, elevated panels |
| foreground | #2C2C2C | #F0EDE8 | Primary text |
| muted | #8A8580 | #9B9590 | Secondary text |
| border | #E8E4DF | #3A3530 | Subtle warm borders |
| success | #5B9A6F | #6BAF7F | Completed tasks |
| warning | #D4A843 | #E0B84D | Pending items |
| error | #C75050 | #D86060 | Alerts |

## Screen List

### 1. Home (Digital Brain)
- Central AI interaction hub
- Chat-style conversation with the Digital Brain
- Voice input button (microphone FAB)
- Quick action chips: "Prepare apartment", "Guest arriving", "Noise complaint"
- Recent activity summary cards at top
- Greeting with resident name and time-of-day context

### 2. Services
- Two sections: "Property Operations" and "Lifestyle Experience"
- **Property Operations:**
  - Zero-Friction Task Delegation
  - Automated Management Pressure
  - Elegant Social Mediation
- **Lifestyle Experience:**
  - Predictive Space Control
  - Invisible VIP Hosting
  - Dynamic Lifestyle Curation
- Each service shows icon, title, description, and tap to interact

### 3. Activity
- Work orders and task tracking
- Tabs: Active / Completed / All
- Each item shows: type (Maintenance/Security/Concierge), status, timestamp
- Filter by category
- Tap to view detail and AI-generated resolution

### 4. Settings
- Resident profile (name, unit, VIP tier)
- Notification preferences
- Privacy mode toggle
- Theme (light/dark)
- About m'AI Touch

## Primary Content & Functionality

### Home Screen
- **AI Chat Interface**: Full-screen conversational UI with the Digital Brain
- **Voice Input**: Floating microphone button for voice commands
- **Quick Actions**: Horizontal scrollable chips for common requests
- **Status Bar**: Shows current apartment status (temperature, privacy mode, etc.)

### Services Screen
- **Service Cards**: Large cards with icons, organized in two categories
- **Property Operations**: Task delegation, management automation, social mediation
- **Lifestyle Experience**: Space control, VIP hosting, lifestyle curation
- Each card navigates to a detail/interaction screen

### Activity Screen
- **Work Order List**: FlatList with status indicators
- **Category Filters**: Maintenance, Security, Concierge tabs
- **Status Badges**: Pending (gold), In Progress (blue), Completed (green)

### Settings Screen
- **Profile Section**: Avatar, name, unit number
- **Preferences**: Notifications, privacy, theme
- **App Info**: Version, about

## Key User Flows

### Flow 1: Voice Command → Task Execution
1. User taps microphone on Home screen
2. Voice input UI activates (animated waveform)
3. User speaks: "So tired. Need the apartment ready, sauna on, and privacy please."
4. Digital Brain processes: Tune Analysis → Regulations Check → Work Order Generation
5. AI response appears in chat with action summary
6. Work orders created and visible in Activity tab

### Flow 2: Guest Arrival Preparation
1. User taps "Guest arriving" quick action or types message
2. Digital Brain asks for details (when, who, preferences)
3. AI generates: touchless entry setup, concierge briefing, amenity preparation
4. Confirmation card appears with all arranged services
5. Work orders appear in Activity tab

### Flow 3: Noise Complaint (Elegant Social Mediation)
1. User reports: "Neighbors are loud again, can you handle it discreetly?"
2. Digital Brain checks community rules and building policy
3. AI proposes discreet resolution approach
4. User confirms, work order created for management
5. Follow-up notification when resolved

### Flow 4: Service Exploration
1. User navigates to Services tab
2. Browses Property Operations or Lifestyle Experience
3. Taps a service card (e.g., "Dynamic Lifestyle Curation")
4. Detail screen shows capabilities and recent uses
5. User can initiate a request directly from service detail

## Layout Specifications

- **Portrait orientation (9:16)**, one-handed usage optimized
- Bottom tab bar with 4 tabs: Home, Services, Activity, Settings
- Home screen: chat takes ~70% height, quick actions at top
- Cards: rounded-2xl corners, subtle shadows, warm tones
- Typography: Clean sans-serif, generous spacing
- Icons: Elegant line icons matching luxury aesthetic
