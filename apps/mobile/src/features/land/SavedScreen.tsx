import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
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
        <Pressable onPress={onClose} style={s.round}><Text style={s.roundText}>✕</Text></Pressable>
        <Text style={s.title}>{t('land.saved')}</Text>
        <View style={{ width: 48 }} />
      </View>

      <FlatList
        data={rows ?? []}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: insets.bottom + 96 }}
        ListEmptyComponent={rows ? <Text style={s.empty}>{t('land.noneSaved')}</Text> : null}
        renderItem={({ item }) => (
          <Pressable onPress={() => onOpen(item)} style={({ pressed }) => [s.card, pressed && s.cardOn]}>
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
              onPress={() => deleteMeasurement(item.id).then(setRows)}
              style={s.del}
            >
              <Text style={s.delText}>🗑</Text>
            </Pressable>
          </Pressable>
        )}
      />

      <Pressable onPress={onNew} style={[s.fab, { bottom: insets.bottom + space.lg }]}>
        <Text style={s.fabText}>{t('land.newMeasure')}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: space.lg },
  round: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface },
  roundText: { fontSize: 20, color: color.ink },
  title: { ...type.title, color: color.ink },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    backgroundColor: color.surface, borderRadius: radius.lg, padding: space.lg,
    borderWidth: 1.5, borderColor: color.line,
  },
  cardOn: { borderColor: color.green, backgroundColor: color.greenSoft },
  name: { ...type.heading, color: color.ink },
  area: { ...type.display, fontSize: 26, lineHeight: 32, color: color.greenDark },
  meta: { ...type.label, color: color.inkMuted },
  date: { ...type.caption, color: color.inkFaint, marginTop: 2 },
  del: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  delText: { fontSize: 20 },
  empty: { ...type.body, color: color.inkMuted, textAlign: 'center', marginTop: space.xxl },
  fab: {
    position: 'absolute', left: space.lg, right: space.lg,
    minHeight: 56, borderRadius: radius.md, backgroundColor: color.green,
    alignItems: 'center', justifyContent: 'center',
  },
  fabText: { ...type.bodyStrong, color: '#fff' },
});
