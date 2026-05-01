/**
 * Production-grade Screen Container
 * Handles safe area insets properly across iOS, Android, and Web.
 */
import React from "react";
import { StyleSheet, View, ViewStyle, Platform } from "react-native";
import { SafeAreaView, Edge } from "react-native-safe-area-context";
import { useColors } from "@/hooks/use-colors";

type ScreenContainerProps = {
  children: React.ReactNode;
  edges?: Edge[];
  style?: ViewStyle;
};

export function ScreenContainer({ children, edges = ["top", "left", "right"], style }: ScreenContainerProps) {
  const colors = useColors();
  
  return (
    <SafeAreaView 
      style={[
        styles.container, 
        { backgroundColor: colors.background },
        style
      ]} 
      edges={edges}
    >
      <View style={styles.inner}>
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inner: {
    flex: 1,
    // Add subtle padding for web to prevent edge-to-edge text on large screens
    paddingHorizontal: Platform.OS === 'web' ? 10 : 0,
  }
});
