/**
 * Audio Waveform Component
 * Real-time audio visualization for voice recording
 */
import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated } from "react-native";
import { useColors } from "@/hooks/use-colors";

type AudioWaveformProps = {
  isRecording: boolean;
  audioLevel?: number; // 0-1
};

const BAR_COUNT = 20;

export function AudioWaveform({ isRecording, audioLevel = 0.5 }: AudioWaveformProps) {
  const colors = useColors();
  const animations = useRef(
    Array.from({ length: BAR_COUNT }, () => new Animated.Value(0.2))
  ).current;

  useEffect(() => {
    if (!isRecording) {
      // Reset all bars
      animations.forEach((anim) => {
        Animated.timing(anim, {
          toValue: 0.2,
          duration: 200,
          useNativeDriver: false,
        }).start();
      });
      return;
    }

    // Animate bars based on audio level
    const interval = setInterval(() => {
      animations.forEach((anim, index) => {
        const randomHeight = Math.random() * audioLevel * 0.8 + 0.2;
        const delay = index * 20;

        Animated.timing(anim, {
          toValue: randomHeight,
          duration: 150 + Math.random() * 100,
          delay,
          useNativeDriver: false,
        }).start();
      });
    }, 150);

    return () => clearInterval(interval);
  }, [isRecording, audioLevel, animations]);

  return (
    <View style={styles.container}>
      {animations.map((anim, index) => (
        <Animated.View
          key={index}
          style={[
            styles.bar,
            {
              backgroundColor: colors.primary,
              height: anim.interpolate({
                inputRange: [0, 1],
                outputRange: ["20%", "100%"],
              }),
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 60,
    gap: 3,
  },
  bar: {
    width: 3,
    borderRadius: 2,
    minHeight: 4,
  },
});
