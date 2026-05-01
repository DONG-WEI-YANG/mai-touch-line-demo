/**
 * useVoiceRecording Hook
 * Handles voice recording with expo-av
 */
import { useState, useCallback, useRef } from "react";
import { Audio } from "expo-av";
import { Alert } from "react-native";

export type RecordingState = "idle" | "recording" | "processing" | "error";

export function useVoiceRecording() {
  const [state, setState] = useState<RecordingState>("idle");
  const [duration, setDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const requestPermissions = useCallback(async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Microphone access is required for voice input."
        );
        return false;
      }
      return true;
    } catch (error) {
      console.error("Permission error:", error);
      return false;
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) return false;

      // Configure audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Create recording
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      recordingRef.current = recording;
      setState("recording");
      setDuration(0);

      // Update duration and audio level
      intervalRef.current = setInterval(async () => {
        if (recordingRef.current) {
          const status = await recordingRef.current.getStatusAsync();
          if (status.isRecording) {
            setDuration(status.durationMillis / 1000);
            // Simulate audio level (expo-av doesn't provide real-time metering)
            setAudioLevel(Math.random() * 0.5 + 0.3);
          }
        }
      }, 100);

      return true;
    } catch (error) {
      console.error("Start recording error:", error);
      setState("error");
      return false;
    }
  }, [requestPermissions]);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    try {
      if (!recordingRef.current) return null;

      setState("processing");

      // Clear interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      // Stop recording
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      setState("idle");
      setDuration(0);
      setAudioLevel(0);

      return uri;
    } catch (error) {
      console.error("Stop recording error:", error);
      setState("error");
      return null;
    }
  }, []);

  const cancelRecording = useCallback(async () => {
    try {
      if (recordingRef.current) {
        await recordingRef.current.stopAndUnloadAsync();
        recordingRef.current = null;
      }

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      setState("idle");
      setDuration(0);
      setAudioLevel(0);
    } catch (error) {
      console.error("Cancel recording error:", error);
    }
  }, []);

  return {
    state,
    duration,
    audioLevel,
    startRecording,
    stopRecording,
    cancelRecording,
    isRecording: state === "recording",
    isProcessing: state === "processing",
  };
}
