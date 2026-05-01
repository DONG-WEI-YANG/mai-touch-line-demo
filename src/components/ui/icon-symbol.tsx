/**
 * Icon Symbol Component
 * Wrapper for SF Symbols / Lucide icons
 */
import React from "react";
import { View } from "react-native";
import * as Icons from "lucide-react-native";

type IconName = keyof typeof Icons;

type IconSymbolProps = {
  name: IconName | string;
  size?: number;
  color?: string;
  strokeWidth?: number;
};

export function IconSymbol({ name, size = 24, color = "#000", strokeWidth = 2 }: IconSymbolProps) {
  // Map common SF Symbol names to Lucide icons
  const iconMap: Record<string, IconName> = {
    "chevron.left": "ChevronLeft",
    "chevron.right": "ChevronRight",
    "chevron.up": "ChevronUp",
    "chevron.down": "ChevronDown",
    "person.fill": "User",
    "person.3.fill": "Users",
    "calendar": "Calendar",
    "calendar.badge.plus": "CalendarPlus",
    "clock.fill": "Clock",
    "mappin.circle.fill": "MapPin",
    "star.fill": "Star",
    "checkmark.circle.fill": "CheckCircle",
    "xmark.circle.fill": "XCircle",
    "exclamationmark.triangle.fill": "AlertTriangle",
    "info.circle.fill": "Info",
    "gear": "Settings",
    "house.fill": "Home",
    "list.bullet": "List",
    "plus": "Plus",
    "minus": "Minus",
    "magnifyingglass": "Search",
    "bell.fill": "Bell",
    "envelope.fill": "Mail",
    "phone.fill": "Phone",
    "message.fill": "MessageCircle",
    "mic.fill": "Mic",
    "speaker.wave.2.fill": "Volume2",
    "fork.knife": "Utensils",
    "dumbbell": "Dumbbell",
    "dumbbell.fill": "Dumbbell",
    "film": "Film",
    "waves": "Waves",
    "home": "Home",
    "doc.text.fill": "FileText",
    "folder.fill": "Folder",
    "trash.fill": "Trash",
    "pencil": "Edit",
    "arrow.right": "ArrowRight",
    "arrow.left": "ArrowLeft",
  };

  const mappedName = iconMap[name] || name;
  const IconComponent = (Icons as any)[mappedName];

  // Check if IconComponent is a valid React component type
  const isValidComponent = 
    typeof IconComponent === 'function' || 
    (typeof IconComponent === 'object' && IconComponent !== null);

  if (!isValidComponent) {
    return <View style={{ width: size, height: size, backgroundColor: 'transparent' }} />;
  }

  return <IconComponent size={size} color={color} strokeWidth={strokeWidth} />;
}
