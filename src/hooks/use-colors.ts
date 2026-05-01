/**
 * useColors Hook - Refined for High Contrast Luxury
 * Provides a more vibrant gold and distinct surface levels.
 */
import { useColorScheme } from "react-native";

export type ColorScheme = {
  primary: string;      // The "Gold"
  background: string;   // Deep background
  surface: string;      // Card/Element background
  foreground: string;   // Main text
  muted: string;        // Secondary text
  border: string;       // Distinct borders
  success: string;
  warning: string;
  error: string;
  cardShadow: string;
};

const lightColors: ColorScheme = {
  primary: "#996515",    // Golden Brown
  background: "#FFFFFF",
  surface: "#F8F5F0",
  foreground: "#1A1A1A",
  muted: "#666666",
  border: "#D1C7BD",
  success: "#2E7D32",
  warning: "#ED6C02",
  error: "#D32F2F",
  cardShadow: "rgba(0,0,0,0.1)",
};

const darkColors: ColorScheme = {
  primary: "#FFD700",    // Vibrant Gold (Classic Metallic)
  background: "#0F0F0F", // Deeper black for more contrast
  surface: "#1E1E1E",    // Lighter surface to pop against background
  foreground: "#FFFFFF", // Pure white for crisp reading
  muted: "#B0B0B0",      // Lighter muted text
  border: "#444444",     // Stronger border definition
  success: "#81C784",
  warning: "#FFB74D",
  error: "#E57373",
  cardShadow: "rgba(0,0,0,0.5)",
};

export function useColors(): ColorScheme {
  const colorScheme = useColorScheme();
  return colorScheme === "dark" ? darkColors : lightColors;
}
