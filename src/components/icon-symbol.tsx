import { IconSymbol as BaseIconSymbol } from "./ui/icon-symbol";
import type { OpaqueColorValue, StyleProp, TextStyle } from "react-native";

type IconSymbolProps = {
  name: string;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  strokeWidth?: number;
};

export function IconSymbol({ name, size = 24, color, strokeWidth }: IconSymbolProps) {
  const resolvedColor = typeof color === "string" ? color : "#000";
  return <BaseIconSymbol name={name} size={size} color={resolvedColor} strokeWidth={strokeWidth} />;
}
