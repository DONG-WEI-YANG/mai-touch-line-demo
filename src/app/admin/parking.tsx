import { useMemo, useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, Alert, ActivityIndicator, RefreshControl, StyleSheet } from 'react-native';
import { trpc } from '@/lib/trpc';
import { useColors } from '@/hooks/use-colors';
import { ScreenContainer } from '@/components/screen-container';
import { AdminHeader, AdminCard, AdminButton, AdminField } from '@/components/admin/admin-ui';
import { parseError } from '@/lib/error-utils';

type SpotType = 'resident' | 'guest' | 'ev';
type Purpose = 'resident_lease' | 'visitor' | 'ev_charge' | 'staff';

export default function AdminParkingPage() {
  const colors = useColors();
  const utils = trpc.useUtils();
  const spots = trpc.parking.spots.useQuery();
  const [showAdd, setShowAdd] = useState(false);
  const [newSpot, setNewSpot] = useState({ label: '', type: 'resident' as SpotType, zone: '' });
  const [assignSpotId, setAssignSpotId] = useState<number | null>(null);
  const [assignDraft, setAssignDraft] = useState({
    plate: '', driverName: '', purpose: 'visitor' as Purpose,
  });

  const addSpot = trpc.parking.addSpot.useMutation({
    onSuccess: () => { 
      utils.parking.spots.invalidate(); 
      setShowAdd(false); 
      setNewSpot({ label: '', type: 'resident', zone: '' }); 
    },
    onError: (err) => Alert.alert('Add failed', parseError(err)),
  });

  const removeSpot = trpc.parking.removeSpot.useMutation({
    onSuccess: () => utils.parking.spots.invalidate(),
    onError: (err) => Alert.alert('Remove failed', parseError(err)),
  });

  const assign = trpc.parking.assign.useMutation({
    onSuccess: () => { 
      utils.parking.spots.invalidate(); 
      setAssignSpotId(null); 
      setAssignDraft({ plate: '', driverName: '', purpose: 'visitor' }); 
    },
    onError: (err) => Alert.alert('Assign failed', parseError(err)),
  });

  const release = trpc.parking.release.useMutation({
    onSuccess: () => utils.parking.spots.invalidate(),
    onError: (err) => Alert.alert('Release failed', parseError(err)),
  });

  const grouped = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const s of (spots.data ?? []) as any[]) {
      const z = s.zone ?? 'Unassigned';
      (groups[z] ||= []).push(s);
    }
    return groups;
  }, [spots.data]);

  const submitAdd = useCallback(() => {
    if (!newSpot.label.trim()) { Alert.alert('Label required'); return; }
    addSpot.mutate({ label: newSpot.label.trim(), type: newSpot.type, zone: newSpot.zone || undefined });
  }, [newSpot, addSpot]);

  const submitAssign = useCallback(() => {
    if (!assignSpotId) return;
    if (!assignDraft.plate.trim()) { Alert.alert('Plate required'); return; }
    assign.mutate({
      spotId: assignSpotId,
      userId: null,
      vehiclePlate: assignDraft.plate.trim(),
      driverName: assignDraft.driverName || undefined,
      purpose: assignDraft.purpose,
    });
  }, [assignSpotId, assignDraft, assign]);

  const getSpotColor = (type: string) => {
    switch (type) {
      case 'resident': return colors.primary;
      case 'guest': return colors.warning;
      case 'ev': return '#60a5fa';
      default: return colors.muted;
    }
  };

  return (
    <ScreenContainer edges={['top']}>
      <AdminHeader 
        title="停車場管理" 
        subtitle={`${(spots.data ?? []).length} spots · ${(spots.data ?? []).filter((s: any) => s.activeAssignment).length} occupied`}
        rightElement={
          <AdminButton 
            title={showAdd ? 'Cancel' : '+ Spot'} 
            type={showAdd ? 'secondary' : 'primary'}
            onPress={() => setShowAdd(!showAdd)}
            style={{ paddingVertical: 8 }}
          />
        }
      />

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={spots.isFetching} onRefresh={() => spots.refetch()} tintColor={colors.primary} />}
      >
        {showAdd && (
          <AdminCard title="Add New Parking Spot" style={styles.composeCard}>
            <AdminField label="Label *" value={newSpot.label} onChangeText={(t) => setNewSpot({ ...newSpot, label: t })} placeholder="e.g. B2-15" />
            <AdminField label="Zone" value={newSpot.zone} onChangeText={(t) => setNewSpot({ ...newSpot, zone: t })} placeholder="e.g. B2" />
            
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>TYPE</Text>
            <View style={styles.typeRow}>
              {(['resident', 'guest', 'ev'] as SpotType[]).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setNewSpot({ ...newSpot, type: t })}
                  style={[
                    styles.typeChip,
                    { backgroundColor: newSpot.type === t ? getSpotColor(t) : colors.surface, borderColor: colors.border }
                  ]}
                >
                  <Text style={[styles.typeChipText, { color: newSpot.type === t ? '#000' : colors.foreground }]}>{t.toUpperCase()}</Text>
                </Pressable>
              ))}
            </View>

            <AdminButton
              title={addSpot.isPending ? 'Adding…' : 'Add Spot'}
              onPress={submitAdd}
              disabled={addSpot.isPending}
            />
          </AdminCard>
        )}

        {spots.isLoading && <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />}

        {Object.entries(grouped).map(([zone, list]) => (
          <View key={zone} style={styles.zoneSection}>
            <Text style={[styles.zoneTitle, { color: colors.muted }]}>{zone.toUpperCase()}</Text>
            <View style={styles.spotGrid}>
              {list.map((s) => {
                const occupied = !!s.activeAssignment;
                const spotColor = getSpotColor(s.type);
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => occupied
                      ? Alert.alert(
                          s.label,
                          `Vehicle: ${s.activeAssignment?.vehiclePlate}\nDriver: ${s.activeAssignment?.driverName ?? 'N/A'}\nPurpose: ${s.activeAssignment?.purpose}`,
                          [
                            { text: 'Close', style: 'cancel' },
                            { text: 'Release Spot', style: 'destructive',
                              onPress: () => release.mutate({ assignmentId: s.activeAssignment.id }) },
                          ],
                        )
                      : setAssignSpotId(s.id)
                    }
                    onLongPress={() => Alert.alert('Remove spot', `Remove ${s.label}?`, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Remove', style: 'destructive', onPress: () => removeSpot.mutate({ id: s.id }) },
                    ])}
                    style={[
                      styles.spotCard,
                      {
                        backgroundColor: occupied ? spotColor + '20' : colors.surface,
                        borderColor: occupied ? spotColor : colors.border,
                      }
                    ]}
                  >
                    <Text style={[styles.spotLabel, { color: colors.foreground }]} numberOfLines={1}>
                      {s.label}
                    </Text>
                    <Text style={[styles.spotType, { color: spotColor }]}>
                      {s.type.toUpperCase()}
                    </Text>
                    {occupied && (
                      <Text style={[styles.spotPlate, { color: colors.foreground }]} numberOfLines={1}>
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
          <AdminCard title={`Assign Spot #${assignSpotId}`} style={styles.assignCard}>
            <AdminField label="License Plate *" value={assignDraft.plate} onChangeText={(t) => setAssignDraft({ ...assignDraft, plate: t })} placeholder="e.g. ABC-1234" />
            <AdminField label="Driver Name" value={assignDraft.driverName} onChangeText={(t) => setAssignDraft({ ...assignDraft, driverName: t })} placeholder="Optional" />
            
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>PURPOSE</Text>
            <View style={styles.typeRow}>
              {(['visitor', 'resident_lease', 'ev_charge', 'staff'] as const).map((p) => (
                <Pressable
                  key={p}
                  onPress={() => setAssignDraft({ ...assignDraft, purpose: p })}
                  style={[
                    styles.typeChip,
                    { backgroundColor: assignDraft.purpose === p ? colors.primary : colors.surface, borderColor: colors.border }
                  ]}
                >
                  <Text style={[styles.typeChipText, { color: assignDraft.purpose === p ? '#000' : colors.foreground }]}>{p.replace('_', ' ').toUpperCase()}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.assignActionRow}>
              <AdminButton 
                title="Cancel" 
                type="secondary" 
                onPress={() => setAssignSpotId(null)} 
                style={{ flex: 1 }}
              />
              <AdminButton 
                title={assign.isPending ? "Assigning..." : "Assign"} 
                onPress={submitAssign} 
                disabled={assign.isPending}
                style={{ flex: 2 }}
              />
            </View>
          </AdminCard>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  composeCard: {
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: 1,
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  typeChipText: {
    fontSize: 10,
    fontWeight: '800',
  },
  zoneSection: {
    marginBottom: 24,
  },
  zoneTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  spotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  spotCard: {
    width: '22%',
    aspectRatio: 1,
    padding: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spotLabel: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  spotType: {
    fontSize: 8,
    fontWeight: '900',
    marginTop: 2,
  },
  spotPlate: {
    fontSize: 9,
    fontWeight: '700',
    marginTop: 4,
  },
  assignCard: {
    marginTop: 12,
    marginBottom: 32,
  },
  assignActionRow: {
    flexDirection: 'row',
    gap: 12,
  },
});
