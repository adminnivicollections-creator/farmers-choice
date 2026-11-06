import React, { useEffect, useState } from 'react';
import {
  LayoutAnimation, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, radius, space, type } from '@fc/tokens';
import { tap } from '../../components/feedback';
import { LandUnit, bagsFor, parseNum, toAcres } from './dose';
import { ProductDose, RECS, Range, Split, productsPerAcre } from './recommendations';
import { zoneForDistrict } from './zones';
import { coarse } from '../../lib/coarse';

const UNITS: LandUnit[] = ['acre', 'gunta', 'cent', 'hectare'];
/** One tap of − / + in each unit. */
const STEP: Record<LandUnit, number> = { acre: 0.5, gunta: 5, cent: 10, hectare: 0.5 };

const CROPS: { key: string; icon: string }[] = [
  { key: 'paddy', icon: 'rice' },
  { key: 'maize', icon: 'corn' },
  { key: 'ragi', icon: 'grain' },
  { key: 'jowar', icon: 'barley' },
  { key: 'redgram', icon: 'seed-outline' },
  { key: 'blackgram', icon: 'seed' },
  { key: 'sugarcane', icon: 'grass' },
  { key: 'sesame', icon: 'flower-outline' },
  { key: 'cotton', icon: 'flower-tulip-outline' },
  { key: 'groundnut', icon: 'peanut-outline' },
  { key: 'turmeric', icon: 'spa' },
].filter((c) => RECS.some((r) => r.crop === c.key));

/** Urea has been sold in 45 kg bags since 2018; the others in 50 kg. */
const LOOK: Record<ProductDose['key'], { bag: number; bg: string; ink: string }> = {
  dap: { bag: 50, bg: '#E6F1FB', ink: '#0C447C' },
  ssp: { bag: 50, bg: '#E6F1FB', ink: '#0C447C' },
  urea: { bag: 45, bg: '#EAF3DE', ink: '#27500A' },
  mop: { bag: 50, bg: '#FAEEDA', ink: '#633806' },
  gypsum: { bag: 50, bg: '#F1EFE8', ink: '#444441' },
};

const kg = ([lo, hi]: Range, times = 1) => {
  const a = Math.round(lo * times), b = Math.round(hi * times);
  return a === b ? `${a} kg` : `${a}–${b} kg`;
};

/**
 * Pick the crop, set the land: the app says how many bags of DAP, urea and
 * MOP to buy, from the official recommendation for Andhra Pradesh.
 */
export default function FertilizerScreen({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [crop, setCrop] = useState<string | null>(null);
  const [variant, setVariant] = useState<string | null>(null);
  const [pickVariant, setPickVariant] = useState(false);
  /** The paddy zone the phone's location points to, when we can tell. */
  const [autoZone, setAutoZone] = useState<string | null>(null);
  const [land, setLand] = useState('1');
  const [unit, setUnit] = useState<LandUnit>('acre');
  const [details, setDetails] = useState(false);

  // Paddy doses differ by zone. Use the location only if it was already
  // allowed on Home -- this screen never asks for it.
  useEffect(() => {
    (async () => {
      try {
        if (!(await Location.getForegroundPermissionsAsync()).granted) return;
        const pos = await Location.getLastKnownPositionAsync();
        if (!pos) return;
        const [addr] = await Location.reverseGeocodeAsync(coarse(pos.coords));
        setAutoZone(zoneForDistrict(addr?.subregion) ?? zoneForDistrict(addr?.city));
      } catch { /* the farmer picks the zone instead */ }
    })();
  }, []);

  const variants = RECS.filter((r) => r.crop === crop && r.variant).map((r) => r.variant!);
  const rec = RECS.find((r) => r.crop === crop && (r.variant ?? null) === (variants.length ? variant : null));
  const n = parseNum(land);
  const acres = n > 0 ? toAcres(n, unit) : null;
  const perAcre = rec ? productsPerAcre(rec) : null;
  const whenLabel = (sp: Split) =>
    'days' in sp ? t(`fert.at_days_${sp.after}`, { days: sp.days }) : t(`fert.at_${sp.at}`);

  const chooseCrop = (c: string) => {
    tap();
    LayoutAnimation.easeInEaseOut();
    const vs = RECS.filter((r) => r.crop === c && r.variant).map((r) => r.variant!);
    setCrop(c);
    setVariant(vs.length ? (autoZone && vs.includes(autoZone) ? autoZone : vs[0]) : null);
    // Zone came from the location: show it, don't ask. Otherwise ask.
    setPickVariant(vs.length > 0 && !(autoZone && vs.includes(autoZone)));
  };

  const stepLand = (dir: 1 | -1) => {
    tap();
    const next = Math.max(0, Math.round(((n > 0 ? n : 0) + dir * STEP[unit]) * 100) / 100);
    setLand(next > 0 ? String(next) : '');
  };

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.head}>
        <Pressable onPress={onClose} hitSlop={12} accessibilityLabel={t('scan.close')}>
          <MaterialCommunityIcons name="arrow-left" size={28} color={color.ink} />
        </Pressable>
        <Text style={s.title}>{t('features.fert')}</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl, gap: space.xl }}
      >
        {/* crop */}
        <View style={{ gap: space.md }}>
          <Text style={s.label}>{t('fert.crop')}</Text>
          <View style={s.tiles}>
            {CROPS.map((c) => {
              const on = c.key === crop;
              return (
                <Pressable
                  key={c.key}
                  onPress={() => chooseCrop(c.key)}
                  style={[s.tile, on && s.tileOn]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                >
                  <MaterialCommunityIcons name={c.icon as any} size={30} color={on ? color.greenDark : color.inkMuted} />
                  <Text style={[s.tileText, on && s.tileTextOn]} numberOfLines={1}>{t(`fert.crop_${c.key}`)}</Text>
                </Pressable>
              );
            })}
          </View>

          {variants.length > 0 && !pickVariant && variant && (
            <Pressable onPress={() => { tap(); setPickVariant(true); }} style={s.zoneLine} hitSlop={8}>
              <MaterialCommunityIcons name="map-marker" size={18} color={color.greenDark} />
              <Text style={s.zoneText}>
                {t(`fert.zone_${variant}`)}{variant === autoZone ? ` · ${t('fert.fromLocation')}` : ''}
              </Text>
              <Text style={s.change}>{t('fert.change')}</Text>
            </Pressable>
          )}
          {variants.length > 0 && pickVariant && (
            <View style={s.chips}>
              {variants.map((v) => (
                <Pressable
                  key={v}
                  onPress={() => { tap(); setVariant(v); setPickVariant(false); }}
                  style={[s.chip, v === variant && s.chipOn]}
                >
                  <Text style={[s.chipText, v === variant && s.chipTextOn]}>{t(`fert.zone_${v}`)}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* land */}
        <View style={{ gap: space.md }}>
          <Text style={s.label}>{t('fert.land')}</Text>
          <View style={s.stepper}>
            <Pressable onPress={() => stepLand(-1)} style={s.stepBtn} accessibilityLabel="−">
              <MaterialCommunityIcons name="minus" size={26} color={color.greenDark} />
            </Pressable>
            <TextInput
              value={land}
              onChangeText={setLand}
              keyboardType="decimal-pad"
              selectTextOnFocus
              style={s.stepValue}
              accessibilityLabel={t('fert.land')}
            />
            <Pressable onPress={() => stepLand(1)} style={s.stepBtn} accessibilityLabel="+">
              <MaterialCommunityIcons name="plus" size={26} color={color.greenDark} />
            </Pressable>
          </View>
          <View style={s.segment}>
            {UNITS.map((u) => (
              <Pressable
                key={u}
                onPress={() => { tap(); setUnit(u); }}
                style={[s.segItem, u === unit && s.segOn]}
              >
                <Text style={[s.segText, u === unit && s.segTextOn]}>{t(`fert.unit_${u}`)}</Text>
              </Pressable>
            ))}
          </View>
          {land.trim().length > 0 && acres == null && <Text style={s.bad}>{t('fert.badArea')}</Text>}
        </View>

        {/* answer: bags first, because bags are what the farmer buys */}
        {rec && perAcre && acres != null && (
          <View style={{ gap: space.md }}>
            <Text style={s.label}>{t('fert.buyFor', { land: `${land} ${t(`fert.unit_${unit}`)}` })}</Text>
            <View style={s.bagRow}>
              {perAcre.map((d) => {
                const look = LOOK[d.key];
                return (
                  <View
                    key={d.key}
                    style={[s.bagCard, perAcre.length > 3 && s.bagCardHalf, { backgroundColor: look.bg }]}
                  >
                    <Text style={[s.bagName, { color: look.ink }]}>{t(`fert.p_${d.key}`)}</Text>
                    <Text style={[s.bagCount, { color: look.ink }]}>{bagsFor(d.perAcre[1] * acres, look.bag)}</Text>
                    <Text style={[s.bagUnit, { color: look.ink }]}>{t('fert.bagsOf', { size: look.bag })}</Text>
                    <Text style={[s.bagKg, { color: look.ink }]}>{kg(d.perAcre, acres)}</Text>
                  </View>
                );
              })}
            </View>

            {/* when to apply: only what the source states, in kg for this field */}
            <View style={s.whenBox}>
              <View style={s.whenHead}>
                <MaterialCommunityIcons name="calendar-clock" size={20} color={color.greenDark} />
                <Text style={s.whenTitle}>{t('fert.whenTitle')}</Text>
              </View>
              {perAcre.map((d) => (
                <Text key={d.key} style={s.whenLine}>
                  <Text style={s.whenProduct}>{t(`fert.p_${d.key}`)}: </Text>
                  {d.timing
                    ? d.timing.map((sp) => `${kg(d.perAcre, acres * sp.share)} ${whenLabel(sp)}`).join(' · ')
                    : t('fert.timingMissing')}
                </Text>
              ))}
            </View>

            <Pressable
              onPress={() => { tap(); LayoutAnimation.easeInEaseOut(); setDetails((d) => !d); }}
              style={s.detailsBtn}
              hitSlop={8}
            >
              <MaterialCommunityIcons name="information-outline" size={20} color={color.inkMuted} />
              <Text style={s.detailsText}>{t('fert.details')}</Text>
              <MaterialCommunityIcons name={details ? 'chevron-up' : 'chevron-down'} size={22} color={color.inkMuted} />
            </Pressable>
            {details && (
              <View style={s.detailsBox}>
                <Text style={s.detailLine}>
                  {t('fert.perAcre')}: {perAcre.map((d) => `${t(`fert.p_${d.key}`)} ${kg(d.perAcre)}`).join(' · ')}
                </Text>
                <Text style={s.detailLine}>{t('fert.soilTestFirst')}</Text>
                <Text style={s.detailMuted}>{t('fert.sourceLabel')}: {rec.source}</Text>
                {!rec.verified && <Text style={s.unverified}>{t('fert.unverified')}</Text>}
                <Text style={s.detailMuted}>{t('fert.notAffiliated')}</Text>
              </View>
            )}
          </View>
        )}

        <Text style={s.detailMuted}>{t('fert.missingCrops')}</Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  title: { ...type.title, color: color.greenDark },
  label: { ...type.heading, color: color.ink },

  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: {
    width: '23%', flexGrow: 1, maxWidth: '25%', minHeight: 84, alignItems: 'center', justifyContent: 'center', gap: 4,
    borderRadius: radius.md, borderWidth: 1, borderColor: color.line, backgroundColor: color.surface,
  },
  tileOn: { borderWidth: 2, borderColor: color.green, backgroundColor: color.greenSoft },
  tileText: { ...type.caption, color: color.inkMuted, paddingHorizontal: 2 },
  tileTextOn: { color: color.greenDark, fontWeight: '700' },

  zoneLine: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 44 },
  zoneText: { ...type.label, color: color.inkMuted, flexShrink: 1 },
  change: { ...type.label, color: color.green, fontWeight: '700', marginLeft: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    minHeight: 48, paddingHorizontal: space.lg, justifyContent: 'center',
    borderRadius: radius.pill, borderWidth: 1, borderColor: color.line, backgroundColor: color.surface,
  },
  chipOn: { backgroundColor: color.green, borderColor: color.green },
  chipText: { ...type.label, color: color.ink },
  chipTextOn: { color: '#fff', fontWeight: '700' },

  stepper: {
    flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.sm,
    borderRadius: radius.lg, borderWidth: 1, borderColor: color.line, backgroundColor: color.surface,
  },
  stepBtn: {
    width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center',
    backgroundColor: color.greenSoft,
  },
  stepValue: { flex: 1, textAlign: 'center', ...type.display, color: color.ink, padding: 0 },
  segment: {
    flexDirection: 'row', padding: 4, borderRadius: radius.md, backgroundColor: color.surfaceAlt,
  },
  segItem: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  segOn: { backgroundColor: color.surface },
  segText: { ...type.label, color: color.inkMuted },
  segTextOn: { color: color.greenDark, fontWeight: '700' },
  bad: { ...type.caption, color: color.danger },

  bagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  bagCardHalf: { flexBasis: '47%', flexGrow: 1 },
  bagCard: { flex: 1, alignItems: 'center', paddingVertical: space.lg, paddingHorizontal: space.xs, borderRadius: radius.lg },
  bagName: { ...type.label, fontWeight: '700' },
  bagCount: { fontSize: 40, lineHeight: 46, fontWeight: '700' },
  bagUnit: { ...type.caption },
  bagKg: { ...type.caption, marginTop: space.xs, opacity: 0.85 },

  whenBox: {
    gap: space.sm, padding: space.lg, borderRadius: radius.lg,
    backgroundColor: color.surface, borderWidth: 1, borderColor: color.line,
  },
  whenHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  whenTitle: { ...type.heading, color: color.ink },
  whenLine: { ...type.label, color: color.ink },
  whenProduct: { fontWeight: '700', color: color.greenDark },
  detailsBtn: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44 },
  detailsText: { ...type.label, color: color.inkMuted, flex: 1 },
  detailsBox: {
    gap: space.sm, padding: space.lg, borderRadius: radius.md,
    backgroundColor: color.surface, borderWidth: 1, borderColor: color.line,
  },
  detailLine: { ...type.label, color: color.ink },
  detailMuted: { ...type.caption, color: color.inkMuted },
  unverified: { ...type.caption, color: color.danger, fontWeight: '700' },
});
