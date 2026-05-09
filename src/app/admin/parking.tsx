import { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, ActivityIndicator, RefreshControl, TextInput } from 'react-native';
import { trpc } from '@/lib/trpc';

const COLORS = {
  bg: '#1a1a1a',
  card: '#252525',
  cardLight: '#2f2f2f',
  accent: '#C9A96E',
  text: '#fff',
  muted: '#888',
  error: '#ff6b6b',
  success: '#4ade80',
  warning: '#fbbf24',
  ev: '#60a5fa',
};

type SpotType = 'resident' | 'guest' | 'ev';
const TYPE_COLOR: Record<SpotType, string> = {
  resident: COLORS.accent,
  guest: COLORS.warning,
  ev: COLORS.ev,
};

export default function AdminParkingPage() {
  const utils = trpc.useUtils();
  const spots = trpc.parking.spots.useQuery();
  const [showAdd, setShowAdd] = useState(false);
  const [newSpot, setNewSpot] = useState({ label: '', type: 'resident' as SpotType, zone: '' });
  const [assignSpotId, setAssignSpotId] = useState<number | null>(null);
  const [assignDraft, setAssignDraft] = useState({
    plate: '', driverName: '', purpose: 'visitor' as 'resident_lease' | 'visitor' | 'ev_charge' | 'staff',
  });

  const addSpot = trpc.parking.addSpot.useMutation({
    onSuccess: () => { utils.parking.spots.invalidate(); setShowAdd(false); setNewSpot({ label: '', type: 'resident', zone: '' }); },
    onError: (err) => Alert.alert('Add failed', err.message),
  });
  const removeSpot = trpc.parking.removeSpot.useMutation({
    onSuccess: () => utils.parking.spots.invalidate(),
    onError: (err) => Alert.alert('Remove failed', err.message),
  });
  const assign = trpc.parking.assign.useMutation({
    onSuccess: () => { utils.parking.spots.invalidate(); setAssignSpotId(null); setAssignDraft({ plate: '', driverName: '', purpose: 'visitor' }); },
    onError: (err) => Alert.alert('Assign failed', err.message),
  });
  const release = trpc.parking.release.useMutation({
    onSuccess: () => utils.parking.spots.invalidate(),
    onError: (err) => Alert.alert('Release failed', err.message),
  });

  const grouped = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const s of (spots.data ?? []) as any[]) {
      const z = s.zone ?? 'Unassigned';
      (groups[z] ||= []).push(s);
    }
    return groups;
  }, [spots.data]);

  const submitAdd = () => {
    if (!newSpot.label.trim()) { Alert.alert('Label required'); return; }
    addSpot.mutate({ label: newSpot.label.trim(), type: newSpot.type, zone: newSpot.zone || undefined });
  };
  const submitAssign = () => {
    if (!assignSpotId) return;
    if (!assignDraft.plate.trim()) { Alert.alert('Plate required'); return; }
    assign.mutate({
      spotId: assignSpotId,
      userId: null,
      vehiclePlate: assignDraft.plate.trim(),
      driverName: assignDraft.driverName || undefined,
      purpose: assignDraft.purpose,
    });
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.bg }}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={spots.isFetching} onRefresh={() => spots.refetch()} tintColor={COLORS.accent} />}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: COLORS.accent, fontSize: 20, fontWeight: 'bold' }}>停車場 (Parking)</Text>
          <Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 2 }}>
            {(spots.data ?? []).length} spots · {(spots.data ?? []).filter((s: any) => s.activeAssignment).length} occupied
          </Text>
        </View>
        <Pressable
          onPress={() => setShowAdd((v) => !v)}
          style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 4,
                   backgroundColor: showAdd ? COLORS.muted : COLORS.accent }}
        >
          <Text style={{ color: showAdd ? '#fff' : '#1a1a1a', fontWeight: 'bold' }}>{showAdd ? 'Cancel' : '+ Spot'}</Text>
        </Pressable>
      </View>

      {showAdd && (
        <View style={{ padding: 12, marginBottom: 16, backgroundColor: COLORS.cardLight, borderRadius: 6 }}>
          <Text style={{ color: COLORS.muted, fontSize: 11, marginBottom: 4 }}>Label *</Text>
          <TextInput
            value={newSpot.label}
            onChangeText={(t) => setNewSpot({ ...newSpot, label: t })}
            placeholder="e.g. B2-15 / GUEST-1 / EV-3"
            placeholderTextColor={COLORS.muted}
            style={{ padding: 8, marginBottom: 8, color: COLORS.text, backgroundColor: COLORS.bg, borderRadius: 4 }}
          />
          <Text style={{ color: COLORS.muted, fontSize: 11, marginBottom: 4 }}>Zone</Text>
          <TextInput
            value={newSpot.zone}
            onChangeText={(t) => setNewSpot({ ...newSpot, zone: t })}
            placeholder="e.g. B1 / B2 / Outdoor"
            placeholderTextColor={COLORS.muted}
            style={{ padding: 8, marginBottom: 8, color: COLORS.text, backgroundColor: COLORS.bg, borderRadius: 4 }}
          />
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
            {(['resident', 'guest', 'ev'] as SpotType[]).map((t) => (
              <Pressable
                key={t}
                onPress={() => setNewSpot({ ...newSpot, type: t })}
                style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 4,
                         backgroundColor: newSpot.type === t ? TYPE_COLOR[t] : COLORS.card }}
              >
                <Text style={{ color: newSpot.type === t ? '#1a1a1a' : '#fff', fontSize: 12 }}>{t}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            disabled={addSpot.isPending}
            onPress={submitAdd}
            style={{ paddingVertical: 10, borderRadius: 4, backgroundColor: COLORS.accent, alignItems: 'center', opacity: addSpot.isPending ? 0.5 : 1 }}
          >
            <Text style={{ color: '#1a1a1a', fontWeight: 'bold' }}>Add spot</Text>
          </Pressable>
        </View>
      )}

      {spots.isLoading && <ActivityIndicator color={COLORS.accent} />}
      {Object.entries(grouped).map(([zone, list]) => (
        <View key={zone} style={{ marginBottom: 16 }}>
          <Text style={{ color: COLORS.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 8 }}>
            {zone.toUpperCase()}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {list.map((s) => {
              const occupied = !!s.activeAssignment;
              const color = TYPE_COLOR[s.type as SpotType];
              return (
                <Pressable
                  key={s.id}
                  onPress={() => occupied
                    ? Alert.alert(
                        s.label,
                        `${s.activeAssignment?.vehiclePlate}\n${s.activeAssignment?.driverName ?? '(no driver)'}\nPurpose: ${s.activeAssignment?.purpose}`,
                        [
                          { text: 'Close' },
                          { text: 'Release', style: 'destructive',
                            onPress: () => release.mutate({ assignmentId: s.activeAssignment.id }) },
                        ],
                      )
                    : setAssignSpotId(s.id)
                  }
                  onLongPress={() => Alert.alert('Remove spot', `Remove ${s.label}?`, [
                    { text: 'Cancel' },
                    { text: 'Remove', style: 'destructive', onPress: () => removeSpot.mutate({ id: s.id }) },
                  ])}
                  style={{
                    width: 80, padding: 8, borderRadius: 6,
                    backgroundColor: occupied ? color + '40' : COLORS.card,
                    borderWidth: 1, borderColor: occupied ? color : COLORS.muted + '40',
                  }}
                >
                  <Text style={{ color: COLORS.text, fontSize: 12, fontWeight: 'bold' }} numberOfLines={1}>
                    {s.label}
                  </Text>
                  <Text style={{ color: color, fontSize: 9, fontWeight: 'bold' }}>
                    {s.type.toUpperCase()}
                  </Text>
                  {occupied && (
                    <Text style={{ color: COLORS.text, fontSize: 9, marginTop: 4 }} numberOfLines={1}>
                      {s.activeAssignment.vehiclePlate}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}

      {assignSpotId && (
        <View style={{ padding: 12, marginTop: 16, backgroundColor: COLORS.cardLight, borderRadius: 6 }}>
          <Text style={{ color: COLORS.accent, fontWeight: 'bold', marginBottom: 8 }}>
            Assign spot #{assignSpotId}
          </Text>
          <TextInput
            value={assignDraft.plate}
            onChangeText={(t) => setAssignDraft({ ...assignDraft, plate: t })}
            placeholder="License plate (e.g. ABC-1234) *"
            placeholderTextColor={COLORS.muted}
            autoCapitalize="characters"
            style={{ padding: 8, marginBottom: 8, color: COLORS.text, backgroundColor: COLORS.bg, borderRadius: 4 }}
          />
          <TextInput
            value={assignDraft.driverName}
            onChangeText={(t) => setAssignDraft({ ...assignDraft, driverName: t })}
            placeholder="Driver name (optional)"
            placeholderTextColor={COLORS.muted}
            style={{ padding: 8, marginBottom: 8, color: COLORS.text, backgroundColor: COLORS.bg, borderRadius: 4 }}
          />
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
            {(['visitor', 'resident_lease', 'ev_charge', 'staff'] as const).map((p) => (
              <Pressable
                key={p}
                onPress={() => setAssignDraft({ ...assignDraft, purpose: p })}
                style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4,
                         backgroundColor: assignDraft.purpose === p ? COLORS.accent : COLORS.card }}
              >
                <Text style={{ color: assignDraft.purpose === p ? '#1a1a1a' : '#fff', fontSize: 11 }}>{p}</Text>
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={() => setAssignSpotId(null)}
              style={{ flex: 1, paddingVertical: 10, borderRadius: 4, backgroundColor: COLORS.muted, alignItems: 'center' }}
            >
              <Text style={{ color: '#fff' }}>Cancel</Text>
            </Pressable>
            <Pressable
              disabled={assign.isPending}
              onPress={submitAssign}
              style={{ flex: 2, paddingVertical: 10, borderRadius: 4, backgroundColor: COLORS.accent, alignItems: 'center', opacity: assign.isPending ? 0.5 : 1 }}
            >
              <Text style={{ color: '#1a1a1a', fontWeight: 'bold' }}>Assign</Text>
            </Pressable>
          </View>
        </View>
      )}
    </ScrollView>
  );
}
