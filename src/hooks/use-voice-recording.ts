/**
 * useVoiceRecording Hook
 * Handles native voice recording with expo-audio.
 */
import { useState, useCallback, useRef } from "react";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { Alert } from "react-native";

import { normalizeRecordingMetering } from "@/lib/audio-metering";

export type RecordingState = "idle" | "recording" | "processing" | "error";

const VOICE_RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  isMeteringEnabled: true,
};

export function useVoiceRecording() {
  const [state, setState] = useState<RecordingState>("idle");
  const recordingActiveRef = useRef(false);
  const recorder = useAudioRecorder(VOICE_RECORDING_OPTIONS);
  const recorderStatus = useAudioRecorderState(recorder, 100);

  const duration = state === "recording" ? recorderStatus.durationMillis / 1000 : 0;
  const audioLevel =
    state === "recording"
      ? normalizeRecordingMetering(recorderStatus.metering)
      : 0;

  const requestPermissions = useCallback(async () => {
    try {
      const { granted } = await AudioModule.requestRecordingPermissionsAsync();
      if (!granted) {
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

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await recorder.prepareToRecordAsync();
      recorder.record();
      recordingActiveRef.current = true;
      setState("recording");

      return true;
    } catch (error) {
      console.error("Start recording error:", error);
      setState("error");
      return false;
    }
  }, [recorder, requestPermissions]);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    try {
      if (!recordingActiveRef.current) return null;

      setState("processing");

      await recorder.stop();
      recordingActiveRef.current = false;
      const uri = recorder.uri;
      await setAudioModeAsync({ allowsRecording: false });

      setState("idle");

      return uri;
    } catch (error) {
      console.error("Stop recording error:", error);
      setState("error");
      return null;
    }
  }, [recorder]);

  const cancelRecording = useCallback(async () => {
    try {
      if (recordingActiveRef.current) {
        await recorder.stop();
        recordingActiveRef.current = false;
      }

      await setAudioModeAsync({ allowsRecording: false });
      setState("idle");
    } catch (error) {
      console.error("Cancel recording error:", error);
    }
  }, [recorder]);

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
