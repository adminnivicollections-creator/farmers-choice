import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { tap } from '../../components/feedback';
import AdBanner from '../../components/AdBanner';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatArea } from '@fc/geo';
import { color, radius, space, type } from '@fc/tokens';
import { SavedMeasurement, deleteMeasurement, listMeasurements } from './storage';

export default function SavedScreen({
  onOpen, onNew, onClose,
}: { onOpen: (m: SavedMeasurement) => void; onNew: () => void; onClose: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<SavedMeasurement[] | null>(null);

  const load = useCallback(() => { listMeasurements().then(setRows); }, []);
  React.useEffect(load, [load]);

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.head}>
        <Pressable onPress={onClose} style={s.round} accessibilityLabel={t('scan.close')}>
          <MaterialCommunityIcons name="close" size={24} color={color.ink} />
        </Pressable>
        <Text style={s.title}>{t('land.saved')}</Text>
        <View style={{ width: 48 }} />
      </View>

      <FlatList
        data={rows ?? []}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: insets.bottom + 96 }}
        ListEmptyComponent={rows ? (
          <View style={s.emptyBox}>
            <MaterialCommunityIcons name="map-marker-path" size={64} color={color.green} />
            <Text style={s.emptyTitle}>{t('land.noneSaved')}</Text>
            <Text style={s.empty}>{t('land.noneSavedHint')}</Text>
          </View>
        ) : null}
        ListFooterComponent={rows && rows.length ? <AdBanner /> : null}
        renderItem={({ item }) => (
          <Pressable onPress={() => { tap(); onOpen(item); }} style={({ pressed }) => [s.card, pressed && s.cardOn]}>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{item.name}</Text>
              <Text style={s.area}>{formatArea(item.areaSquareMeters, 'acre')}</Text>
              <Text style={s.meta}>
                {formatArea(item.areaSquareMeters, 'sqft')} · {item.cents.toFixed(1)} cents
              </Text>
              <Text style={s.date}>
                {new Date(item.createdAt).toLocaleDateString()} · {t(`land.${item.method}`)}
                {item.accuracyMetres != null ? ` · ±${Math.round(item.accuracyMetres)} m` : ''}
              </Text>
            </View>
            <Pressable
              hitSlop={12}
              accessibilityLabel={t('land.delete')}
              onPress={() => deleteMeasurement(item.id).then(setRows, () => Alert.alert(t('common.error')))}
              style={s.del}
            >
              <MaterialCommunityIcons name="delete-outline" size={24} color={color.inkMuted} />
            </Pressable>
          </Pressable>
        )}
      />

      <Pressable onPress={() => { tap(); onNew(); }} style={[s.fab, { bottom: insets.bottom + space.lg }]}>
        <Text style={s.fabText}>{t('land.newMeasure')}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: space.lg },
  round: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface },
  title: { ...type.title, color: color.ink },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    backgroundColor: color.surface, borderRadius: radius.lg, padding: space.lg,
    borderWidth: 1, borderColor: color.line,
  },
  cardOn: { borderColor: color.green, backgroundColor: color.greenSoft },
  name: { ...type.heading, color: color.ink },
  area: { ...type.display, fontSize: 26, lineHeight: 32, color: color.greenDark },
  meta: { ...type.label, color: color.inkMuted },
  date: { ...type.caption, color: color.inkFaint, marginTop: 2 },
  del: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  emptyBox: { alignItems: 'center', gap: space.sm, marginTop: space.xxl, paddingHorizontal: space.xl },
  emptyTitle: { ...type.heading, color: color.ink, textAlign: 'center' },
  empty: { ...type.body, color: color.inkMuted, textAlign: 'center' },
  fab: {
    position: 'absolute', left: space.lg, right: space.lg,
    minHeight: 56, borderRadius: radius.md, backgroundColor: color.green,
    alignItems: 'center', justifyContent: 'center',
  },
  fabText: { ...type.bodyStrong, color: '#fff' },
});
