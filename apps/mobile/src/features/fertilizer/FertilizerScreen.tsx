import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, radius, space, type } from '@fc/tokens';
import { LandUnit, bagsFor, parseNum, toAcres } from './dose';
import { RECS, Range, productsPerAcre } from './recommendations';

const UNITS: LandUnit[] = ['acre', 'gunta', 'cent', 'hectare'];
const CROPS = [...new Set(RECS.map((r) => r.crop))];

/** Urea has been sold in 45 kg bags since 2018; DAP and MOP in 50 kg. */
const BAGS = { dap: 50, urea: 45, mop: 50 } as const;

const kg = ([lo, hi]: Range, times = 1) => {
  const a = Math.round(lo * times), b = Math.round(hi * times);
  return a === b ? `${a} kg` : `${a}–${b} kg`;
};

/**
 * Pick the crop and enter the land: the app says how much DAP, urea and MOP
 * to use, from the official recommendation for Andhra Pradesh. Works offline.
 */
export default function FertilizerScreen({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [crop, setCrop] = useState<string | null>(null);
  const [variant, setVariant] = useState<string | null>(null);
  const [land, setLand] = useState('');
  const [unit, setUnit] = useState<LandUnit>('acre');

  const variants = RECS.filter((r) => r.crop === crop && r.variant).map((r) => r.variant!);
  const rec = RECS.find((r) => r.crop === crop && (r.variant ?? null) === (variants.length ? variant : null));
  const acres = parseNum(land) > 0 ? toAcres(parseNum(land), unit) : null;
  const perAcre = rec ? productsPerAcre(rec) : null;
  const bad = land.trim().length > 0 && acres == null;

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
        contentContainerStyle={{ padding: space.lg, paddingBottom: space.xl, gap: space.xl }}
      >
        <Step n={1} icon="sprout" label={t('fert.crop')}>
          <Chips
            options={CROPS.map((c) => [c, t(`fert.crop_${c}`)])}
            value={crop}
            onChange={(c) => {
              setCrop(c);
              // Paddy defaults to the Krishna zone (Guntur, the pilot district).
              setVariant(RECS.find((r) => r.crop === c && r.variant)?.variant ?? null);
            }}
          />
          {variants.length > 0 && (
            <Chips
              options={variants.map((v) => [v, t(`fert.zone_${v}`)])}
              value={variant}
              onChange={setVariant}
            />
          )}
        </Step>

        <Step n={2} icon="ruler-square" label={t('fert.land')}>
          <TextInput
            value={land}
            onChangeText={setLand}
            keyboardType="decimal-pad"
            placeholder="2.5"
            placeholderTextColor={color.inkFaint}
            style={s.input}
          />
          <Chips
            options={UNITS.map((u) => [u, t(`fert.unit_${u}`)])}
            value={unit}
            onChange={(v) => setUnit(v as LandUnit)}
          />
          {bad && <Text style={s.bad}>{t('fert.badArea')}</Text>}
        </Step>

        {rec && perAcre && (
          <View style={s.result} accessibilityLiveRegion="polite">
            <View style={s.row}>
              <Text style={[s.cell, s.cellHead, { flex: 1.2 }]}>{t('fert.product')}</Text>
              <Text style={[s.cell, s.cellHead]}>{t('fert.perAcre')}</Text>
              {acres != null && <Text style={[s.cell, s.cellHead]}>{t('fert.yourLand')}</Text>}
            </View>
            {(['dap', 'urea', 'mop'] as const).filter((k) => perAcre[k][1] > 0).map((k) => (
              <View key={k} style={s.row}>
                <Text style={[s.cell, s.product, { flex: 1.2 }]}>{t(`fert.p_${k}`)}</Text>
                <Text style={s.cell}>{kg(perAcre[k])}</Text>
                {acres != null && (
                  <Text style={s.cell}>
                    {kg(perAcre[k], acres)}{'\n'}
                    <Text style={s.bags}>
                      {t('fert.bagsToBuy', { count: bagsFor(perAcre[k][1] * acres, BAGS[k]), size: BAGS[k] })}
                    </Text>
                  </Text>
                )}
              </View>
            ))}
            <Text style={s.note}>{t('fert.soilTestFirst')}</Text>
            <Text style={s.source}>{t('fert.sourceLabel')}: {rec.source}</Text>
            {!rec.verified && <Text style={s.unverified}>{t('fert.unverified')}</Text>}
          </View>
        )}

        <Text style={s.note}>{t('fert.missingCrops')}</Text>
      </ScrollView>
    </View>
  );
}

function Step({
  n, icon, label, children,
}: { n: number; icon: any; label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.md }}>
      <View style={s.stepHead}>
        <View style={s.stepNum}><Text style={s.stepNumText}>{n}</Text></View>
        <MaterialCommunityIcons name={icon} size={22} color={color.greenDark} />
        <Text style={s.stepLabel}>{label}</Text>
      </View>
      {children}
    </View>
  );
}

function Chips({
  options, value, onChange,
}: { options: [string, string][]; value: string | null; onChange: (v: string) => void }) {
  return (
    <View style={s.chips}>
      {options.map(([k, label]) => {
        const on = k === value;
        return (
          <Pressable
            key={k}
            onPress={() => onChange(k)}
            style={[s.chip, on && s.chipOn]}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
          >
            <Text style={[s.chipText, on && s.chipTextOn]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.surface },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  title: { ...type.display, fontSize: 24, color: color.greenDark },

  stepHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  stepNum: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: color.greenSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  stepNumText: { ...type.caption, fontWeight: '700', color: color.greenDark },
  stepLabel: { ...type.heading, color: color.ink },

  input: {
    minHeight: 56, borderWidth: 1.5, borderColor: color.line, borderRadius: radius.md,
    paddingHorizontal: space.lg, ...type.body, color: color.ink, backgroundColor: color.bg,
  },
  note: { ...type.caption, color: color.inkMuted },
  bad: { ...type.caption, color: color.danger },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    minHeight: 48, paddingHorizontal: space.lg, justifyContent: 'center',
    borderRadius: radius.pill, borderWidth: 1.5, borderColor: color.line, backgroundColor: color.bg,
  },
  chipOn: { backgroundColor: color.green, borderColor: color.green },
  chipText: { ...type.label, color: color.ink },
  chipTextOn: { color: '#fff', fontWeight: '700' },

  result: {
    gap: space.sm, padding: space.lg, borderRadius: radius.lg,
    backgroundColor: color.greenSoft, borderWidth: 2, borderColor: color.green,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  cell: { flex: 1, ...type.body, color: color.ink },
  cellHead: { ...type.caption, color: color.inkMuted },
  product: { fontWeight: '700', color: color.greenDark },
  bags: { ...type.caption, color: color.inkMuted },
  source: { ...type.caption, color: color.inkMuted },
  unverified: { ...type.caption, color: color.danger, fontWeight: '700' },
});
