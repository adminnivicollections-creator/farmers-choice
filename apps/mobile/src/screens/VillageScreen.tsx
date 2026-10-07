import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Location from 'expo-location';
import { color, radius, space, type } from '@fc/tokens';
import { api } from '../lib/api';
import { Button, ErrorText, Field, Screen, Sub, Title } from '../components/ui';

type Village = { id: string; name: string; nameEn: string; label: string };

export default function VillageScreen({ onDone }: { onDone: () => void }) {
  const { t, i18n } = useTranslation();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Village[]>([]);
  const [picked, setPicked] = useState<Village | null>(null);
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Debounced so a slow connection isn't hit on every keystroke.
  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    const id = setTimeout(async () => {
      try { setResults(await api.searchVillages(q, i18n.language)); }
      catch { setResults([]); }
    }, 300);
    return () => clearTimeout(id);
  }, [q, i18n.language]);

  /** Permission is asked here, at the moment it is used -- not at launch. */
  async function useMyLocation() {
    setLocating(true); setErr(null);
    try {
      // Three distinct failures, three distinct messages. Telling someone who
      // denied permission "no village found" sends them looking for the wrong fix.
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setErr(t('village.permissionOff')); return; }

      let pos;
      try {
        pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      } catch {
        setErr(t('village.noFix')); return;
      }

      const r = await api.resolveVillage(pos.coords.latitude, pos.coords.longitude, i18n.language);
      if (r.village) { setPicked(r.village); setQ(r.village.name); setResults([]); }
      else setErr(t('village.notFound'));
    } catch {
      setErr(t('common.error'));
    } finally {
      setLocating(false);
    }
  }

  async function save() {
    if (!picked) return;
    setBusy(true); setErr(null);
    try { await api.updateMe({ villageId: picked.id }); onDone(); }
    catch { setErr(t('common.error')); }
    finally { setBusy(false); }
  }

  return (
    <Screen>
      <Title>{t('village.title')}</Title>
      <Sub>{t('village.subtitle')}</Sub>

      <Button
        label={locating ? t('village.locating') : t('village.useLocation')}
        variant="ghost"
        onPress={useMyLocation}
        busy={locating}
      />

      <Field
        value={q}
        onChangeText={(v) => { setQ(v); setPicked(null); }}
        placeholder={t('village.searchPlaceholder')}
      />

      <ErrorText>{err}</ErrorText>

      <FlatList
        style={{ flex: 1 }}
        data={results}
        keyExtractor={(i) => i.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => { setPicked(item); setQ(item.name); setResults([]); }}
            style={s.row}
          >
            <Text style={s.rowName}>{item.name}</Text>
            <Text style={s.rowSub}>{item.label}</Text>
          </Pressable>
        )}
      />

      {picked ? (
        <View style={s.picked}>
          <Text style={s.pickedName}>{picked.name}</Text>
          <Text style={s.rowSub}>{picked.label}</Text>
        </View>
      ) : null}

      <Button label={t('village.save')} onPress={save} disabled={!picked} busy={busy} />
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { paddingVertical: space.lg, borderBottomWidth: 1, borderBottomColor: color.line },
  rowName: { ...type.bodyStrong, color: color.ink },
  rowSub: { ...type.caption, color: color.inkMuted, marginTop: 2 },
  picked: {
    backgroundColor: color.greenSoft, borderRadius: radius.md, padding: space.lg,
    borderWidth: 1.5, borderColor: color.green,
  },
  pickedName: { ...type.heading, color: color.greenDark },
});
