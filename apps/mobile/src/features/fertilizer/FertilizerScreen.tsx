import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, radius, space, type } from '@fc/tokens';
import { LandUnit, doseFor, parseNum } from './dose';

/** Standard Indian bag sizes. Urea has been sold in 45 kg bags since 2018. */
const PRODUCTS: { key: string; bagKg: number }[] = [
  { key: 'urea', bagKg: 45 },
  { key: 'dap', bagKg: 50 },
  { key: 'mop', bagKg: 50 },
  { key: 'ssp', bagKg: 50 },
  { key: 'complex', bagKg: 50 },
];

const UNITS: LandUnit[] = ['acre', 'gunta', 'cent', 'hectare'];

/**
 * Simple calculator: product, dose per acre, land -> total kg and bags.
 * Works offline. The dose comes from the farmer (soil card / agriculture
 * officer); the app only does the arithmetic.
 */
export default function FertilizerScreen({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [product, setProduct] = useState('urea');
  const [bagKg, setBagKg] = useState(45);
  const [dose, setDose] = useState('');
  const [land, setLand] = useState('');
  const [unit, setUnit] = useState<LandUnit>('acre');

  const result = doseFor(parseNum(dose), parseNum(land), unit, bagKg);
  const bad = (s: string) => s.trim().length > 0 && !(parseNum(s) > 0);

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
        <Step n={1} icon="sack" label={t('fert.product')}>
          <Chips
            options={PRODUCTS.map((p) => [p.key, t(`fert.p_${p.key}`)])}
            value={product}
            onChange={(k) => {
              setProduct(k);
              setBagKg(PRODUCTS.find((p) => p.key === k)!.bagKg);
            }}
          />
        </Step>

        <Step n={2} icon="scale" label={t('fert.dose')}>
          <TextInput
            value={dose}
            onChangeText={setDose}
            keyboardType="decimal-pad"
            placeholder="50"
            placeholderTextColor={color.inkFaint}
            style={s.input}
          />
          {bad(dose) && <Text style={s.bad}>{t('fert.badArea')}</Text>}
          <Text style={s.note}>{t('fert.doseNote')}</Text>
        </Step>

        <Step n={3} icon="ruler-square" label={t('fert.land')}>
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
          {bad(land) && <Text style={s.bad}>{t('fert.badArea')}</Text>}
        </Step>

        <Step n={4} icon="package-variant" label={t('fert.bagSize')}>
          <Chips
            options={[[ '45', '45 kg' ], [ '50', '50 kg' ]]}
            value={String(bagKg)}
            onChange={(v) => setBagKg(Number(v))}
          />
        </Step>

        {result && (
          <View style={s.result} accessibilityLiveRegion="polite">
            <Text style={s.resultLabel}>{t('fert.total')}</Text>
            <Text style={s.resultBig}>{result.totalKg} kg</Text>
            <Text style={s.resultLabel}>{t('fert.bagsLabel')}</Text>
            <Text style={s.resultBags}>
              {result.bags} × {bagKg} kg{result.looseKg > 0 ? `  +  ${result.looseKg} kg` : ''}
            </Text>
          </View>
        )}
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
    gap: space.xs, padding: space.lg, borderRadius: radius.lg,
    backgroundColor: color.greenSoft, borderWidth: 2, borderColor: color.green,
  },
  resultLabel: { ...type.caption, color: color.inkMuted },
  resultBig: { ...type.display, fontSize: 36, color: color.greenDark },
  resultBags: { ...type.title, color: color.ink },
});
