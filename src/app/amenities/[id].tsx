import { useState, useCallback, useMemo } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useApp } from "@/lib/app-context";
import { AMENITIES, formatDateDisplay, getDayLabel, getNext7Days } from "@/lib/amenities";
import { trpc } from "@/lib/trpc";

type BookingStep = "details" | "slots" | "confirm" | "success";

export default function AmenityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const router = useRouter();
  const { t, state: _state } = useApp();

  const amenity = AMENITIES.find((a) => a.id === id);

  const [step, setStep] = useState<BookingStep>("details");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [guestCount, setGuestCount] = useState("2");
  const [notes, setNotes] = useState("");

  const dates = useMemo(() => getNext7Days(), []);

  // Real-time slot availability from backend
  const { data: slots = [], isLoading: slotsLoading } = trpc.amenities.getSlots.useQuery(
    { amenityId: parseInt(id?.replace("am-", "") || "0"), date: selectedDate },
    { enabled: !!selectedDate && !!id }
  );

  const createBookingMutation = trpc.bookings.create.useMutation();

  const handleSelectDate = useCallback((date: string) => {
    setSelectedDate(date);
    setSelectedSlot(null);
  }, []);

  const handleSelectSlot = useCallback((slot: any) => {
    if (!slot.available) return;
    setSelectedSlot(slot);
    // Auto-adjust guest count if exceeds remaining
    setGuestCount(prev => {
      const current = parseInt(prev, 10);
      return current > slot.remainingCapacity ? String(slot.remainingCapacity) : prev;
    });
  }, []);

  const handleProceedToSlots = useCallback(() => {
    if (!dates.length) return;
    setSelectedDate(dates[0]);
    setStep("slots");
  }, [dates]);

  const handleConfirmBooking = useCallback(async () => {
    if (!amenity || !selectedSlot) return;

    try {
      await createBookingMutation.mutateAsync({
        amenityId: parseInt(amenity.id.replace("am-", "")),
        date: selectedDate,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        guestCount: parseInt(guestCount, 10) || 2,
        notes: notes.trim() || undefined,
      });
      setStep("success");
    } catch (error: any) {
      Alert.alert("Booking Failed", error.message || "Something went wrong");
    }
  }, [amenity, selectedSlot, selectedDate, guestCount, notes, createBookingMutation]);

  if (!amenity) {
    return (
      <ScreenContainer edges={["top"]}><View style={styles.center}><Text>{t("amenity.not_found")}</Text></View></ScreenContainer>
    );
  }

  // Success Screen
  if (step === "success") {
    return (
      <ScreenContainer edges={["top", "left", "right"]}>
        <View style={styles.successContainer}>
          <View style={[styles.successCircle, { backgroundColor: colors.success + "20" }]}>
            <IconSymbol name="checkmark.circle.fill" size={64} color={colors.success} />
          </View>
          <Text style={[styles.successTitle, { color: colors.foreground }]}>{t("amenity.success_title")}</Text>
          <Text style={[styles.successSub, { color: colors.muted }]}>{t("amenity.success_sub")}</Text>
          
          <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
             <Text style={[styles.summaryText, { color: colors.foreground }]}>{amenity.name}</Text>
             <Text style={[styles.summaryDetail, { color: colors.muted }]}>{formatDateDisplay(selectedDate)} | {selectedSlot?.startTime}</Text>
          </View>

          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary }]} onPress={() => router.push("/my-bookings" as any)}>
            <Text style={styles.primaryBtnText}>{t("amenity.view_bookings")}</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: colors.surface }]} onPress={() => step === "details" ? router.back() : setStep("details")}>
          <IconSymbol name="chevron.left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{step === "details" ? amenity.name : t("amenity.select_date")}</Text>
        <View style={{ width: 40 }} />
      </View>

      {step === "details" && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={[styles.hero, { backgroundColor: amenity.imageColor + "20" }]}>
            <IconSymbol name={amenity.icon as any} size={60} color={amenity.imageColor} />
          </View>
          <View style={styles.detailBody}>
            <Text style={[styles.description, { color: colors.foreground }]}>{amenity.description}</Text>
            
            <View style={[styles.infoRow, { borderColor: colors.border }]}>
              <IconSymbol name="person.3.fill" size={20} color={colors.primary} />
              <Text style={[styles.infoText, { color: colors.foreground }]}>{t("amenity.capacity")}: {amenity.capacity} {t("common.guests")}</Text>
            </View>

            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("amenity.rules")}</Text>
            {amenity.rules.map((r, i) => (
              <Text key={i} style={[styles.ruleText, { color: colors.muted }]}>• {r}</Text>
            ))}

            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary, marginTop: 30 }]} onPress={handleProceedToSlots}>
              <Text style={styles.primaryBtnText}>{t("amenity.select_date")}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {step === "slots" && (
        <View style={{ flex: 1 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.datePicker}>
            {dates.map(d => (
              <TouchableOpacity 
                key={d} 
                style={[styles.dateChip, selectedDate === d && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                onPress={() => handleSelectDate(d)}
              >
                <Text style={[styles.dateText, selectedDate === d && { color: "#000" }]}>{getDayLabel(d).slice(0, 3)}</Text>
                <Text style={[styles.dateNum, selectedDate === d && { color: "#000" }]}>{d.split("-")[2]}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ScrollView contentContainerStyle={styles.slotsGrid}>
            {slotsLoading ? <ActivityIndicator color={colors.primary} /> : 
              slots.map((s: any) => (
                <TouchableOpacity 
                  key={s.startTime} 
                  disabled={!s.available}
                  style={[styles.slotCard, { backgroundColor: colors.surface, borderColor: selectedSlot?.startTime === s.startTime ? colors.primary : colors.border }]}
                  onPress={() => handleSelectSlot(s)}
                >
                  <Text style={[styles.slotTime, { color: colors.foreground }]}>{s.startTime}</Text>
                  <Text style={[styles.slotLeft, { color: s.available ? colors.primary : colors.error }]}>
                    {s.available ? `${s.remainingCapacity} left` : "Full"}
                  </Text>
                </TouchableOpacity>
              ))
            }
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity 
              style={[styles.primaryBtn, { backgroundColor: selectedSlot ? colors.primary : colors.muted }]} 
              disabled={!selectedSlot}
              onPress={() => setStep("confirm")}
            >
              <Text style={styles.primaryBtnText}>{t("amenity.continue")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {step === "confirm" && (
        <View style={styles.detailBody}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("amenity.confirm_title")}</Text>
          <View style={[styles.confirmCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={{ color: colors.muted }}>{t("common.date")}: {selectedDate}</Text>
            <Text style={{ color: colors.muted }}>{t("common.time")}: {selectedSlot?.startTime}</Text>
            
            <Text style={[styles.fieldLabel, { color: colors.foreground, marginTop: 20 }]}>{t("amenity.guests")}</Text>
            <View style={styles.guestPicker}>
               <TouchableOpacity onPress={() => setGuestCount(s => String(Math.max(1, parseInt(s)-1)))}><IconSymbol name="minus" color={colors.primary} /></TouchableOpacity>
               <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: 'bold' }}>{guestCount}</Text>
               <TouchableOpacity onPress={() => setGuestCount(s => String(Math.min(selectedSlot?.remainingCapacity || 1, parseInt(s)+1)))}><IconSymbol name="plus" color={colors.primary} /></TouchableOpacity>
            </View>

            <TextInput 
              style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
              placeholder={t("amenity.notes_placeholder")}
              value={notes}
              onChangeText={setNotes}
              multiline
            />
          </View>

          <TouchableOpacity 
            style={[styles.primaryBtn, { backgroundColor: colors.primary, marginTop: 20 }]} 
            onPress={handleConfirmBooking}
            disabled={createBookingMutation.isLoading}
          >
            {createBookingMutation.isLoading ? <ActivityIndicator color="#000" /> : <Text style={styles.primaryBtnText}>{t("amenity.confirm_btn")}</Text>}
          </TouchableOpacity>
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20 },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  scrollContent: { paddingBottom: 40 },
  hero: { height: 200, justifyContent: 'center', alignItems: 'center', margin: 20, borderRadius: 24 },
  detailBody: { paddingHorizontal: 24 },
  description: { fontSize: 16, lineHeight: 24, marginBottom: 20 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 15, borderBottomWidth: 1 },
  infoText: { fontSize: 15, fontWeight: '600' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 24, marginBottom: 12 },
  ruleText: { fontSize: 14, marginBottom: 8, lineHeight: 20 },
  primaryBtn: { height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 10 },
  primaryBtnText: { fontSize: 16, fontWeight: 'bold', color: '#000' },
  datePicker: { paddingHorizontal: 20, maxHeight: 100, marginBottom: 20 },
  dateChip: { width: 60, height: 80, borderRadius: 15, borderWidth: 1, borderColor: '#333', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  dateText: { fontSize: 12, color: '#888' },
  dateNum: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, padding: 20 },
  slotCard: { width: '47%', padding: 16, borderRadius: 16, borderWidth: 1.5 },
  slotTime: { fontSize: 16, fontWeight: 'bold' },
  slotLeft: { fontSize: 12, marginTop: 4 },
  footer: { padding: 20, borderTopWidth: 1, borderTopColor: '#222' },
  confirmCard: { padding: 20, borderRadius: 20, borderWidth: 1 },
  fieldLabel: { fontSize: 14, fontWeight: '600' },
  guestPicker: { flexDirection: 'row', alignItems: 'center', gap: 20, marginVertical: 15 },
  input: { marginTop: 15, borderWidth: 1, borderRadius: 12, padding: 15, minHeight: 80 },
  successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  successCircle: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  successTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
  successSub: { fontSize: 16, textAlign: 'center', marginBottom: 30 },
  summaryCard: { padding: 20, borderRadius: 15, borderWidth: 1, width: '100%', marginBottom: 30 },
  summaryText: { fontSize: 18, fontWeight: 'bold' },
  summaryDetail: { fontSize: 14, marginTop: 5 },
});
