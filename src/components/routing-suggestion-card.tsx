/**
 * Routing Suggestion Card
 * Shows navigation suggestions based on NLP intent detection
 */
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

type RoutingSuggestion = {
  intent: string;
  route: string;
  title: string;
  description: string;
  icon: string;
};

type RoutingSuggestionCardProps = {
  suggestion: RoutingSuggestion;
  onDismiss: () => void;
};

export function RoutingSuggestionCard({ suggestion, onDismiss }: RoutingSuggestionCardProps) {
  const colors = useColors();
  const router = useRouter();

  const handleNavigate = () => {
    router.push(suggestion.route as any);
    onDismiss();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.primary + "15", borderColor: colors.primary }]}>
      <View style={[styles.iconContainer, { backgroundColor: colors.primary + "30" }]}>
        <IconSymbol name={suggestion.icon as any} size={24} color={colors.primary} />
      </View>

      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.foreground }]}>{suggestion.title}</Text>
        <Text style={[styles.description, { color: colors.muted }]}>{suggestion.description}</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.button, styles.primaryButton, { backgroundColor: colors.primary }]}
          onPress={handleNavigate}
          activeOpacity={0.7}
        >
          <Text style={styles.primaryButtonText}>Go</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton, { borderColor: colors.border }]}
          onPress={onDismiss}
          activeOpacity={0.7}
        >
          <IconSymbol name="xmark.circle.fill" size={20} color={colors.muted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginVertical: 8,
    gap: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 2,
  },
  description: {
    fontSize: 13,
    lineHeight: 17,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButton: {
    paddingHorizontal: 16,
    width: "auto",
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  secondaryButton: {
    borderWidth: 1,
  },
});
