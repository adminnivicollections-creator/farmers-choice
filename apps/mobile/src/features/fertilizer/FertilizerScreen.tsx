import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, radius, space, type } from '@fc/tokens';
import { api } from '../../lib/api';
import { INDIAN_STATES } from './states';
import Results from './Results';

export type Season = 'KHARIF' | 'RABI' | 'SUMMER' | 'PERENNIAL';
export type Irrigation = 'IRRIGATED' | 'RAINFED';
export type AreaUnit = 'acre' | 'hectare' | 'gunta' | 'cent';

type Crop = { slug: string; nameEn: string; nameTe: string; nameHi: string; hasPublishedRecommendation: boolean };

export default function FertilizerScreen({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();

  const [crops, setCrops] = useState<Crop[] | null>(null);
  const [state, setState] = useState<string | null>(null);
  const [district, setDistrict] = useState('');
  const [crop, setCrop] = useState<Crop | null>(null);
  const [season, setSeason] = useState<Season | null>(null);
  const [irrigation, setIrrigation] = useState<Irrigation | null>(null);
  const [area, setArea] = useState('');
  const [unit, setUnit] = useState<AreaUnit>('acre');
  const [hasSoilTest, setHasSoilTest] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [picker, setPicker] = useState<'state' | 'crop' | null>(null);

  useEffect(() => { api.fertCrops().then(setCrops).catch(() => setCrops([])); }, []);

  const cropName = (c: Crop) =>
    (i18n.language === 'te' ? c.nameTe : i18n.language === 'hi' ? c.nameHi : c.nameEn) || c.nameEn;

  const areaNum = Number(area);
  const areaValid = Number.isFinite(areaNum) && areaNum > 0;
  const ready = Boolean(state && crop && season && irrigation && areaValid && hasSoilTest !== null);

  async function calculate() {
    setBusy(true);
    try {
      setResult(await api.fertCalculate({
        state: state!, district: district.trim() || undefined,
        cropSlug: crop!.slug, season: season!, irrigation: irrigation!,
        areaValue: areaNum, areaUnit: unit,
      }));
    } catch {
      setResult({ available: false, reason: 'error', message: t('common.error'), suggestions: [] });
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <Results
        result={result}
        crop={crop ? cropName(crop) : ''}
        area={`${area} ${t(`fert.unit_${unit}`)}`}
        hasSoilTest={!!hasSoilTest}
        onBack={() => setResult(null)}
        onClose={onClose}
      />
    );
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.head}>
        <Pressable onPress={onClose} hitSlop={12}>
          <MaterialCommunityIcons name="arrow-left" size={28} color={color.ink} />
        </Pressable>
        <Text style={s.title}>{t('features.fert')}</Text>
      </View>

      <ScrollView style={{ flex: 1 }}
        contentContainerStyle={{ padding: space.lg, paddingBottom: space.xl, gap: space.xl }}>
        <Step n={1} icon="map-marker" label={t('fert.location')}>
          <Select value={state ?? t('fert.pickState')} on={!!state} onPress={() => setPicker('state')} />
          <TextInput
            value={district}
            onChangeText={setDistrict}
            placeholder={t('fert.districtOptional')}
            placeholderTextColor={color.inkFaint}
            style={s.input}
          />
        </Step>

        <Step n={2} icon="sprout" label={t('fert.crop')}>
          <Select
            value={crop ? cropName(crop) : t('fert.pickCrop')}
            on={!!crop}
            onPress={() => setPicker('crop')}
          />
          <Chips
            options={[['KHARIF', t('fert.kharif')], ['RABI', t('fert.rabi')], ['SUMMER', t('fert.summer')]]}
            value={season}
            onChange={(v) => setSeason(v as Season)}
          />
          <Chips
            options={[['IRRIGATED', t('fert.irrigated')], ['RAINFED', t('fert.rainfed')]]}
            value={irrigation}
            onChange={(v) => setIrrigation(v as Irrigation)}
          />
        </Step>

        <Step n={3} icon="ruler-square" label={t('fert.land')}>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <TextInput
              value={area}
              onChangeText={setArea}
              keyboardType="decimal-pad"
              placeholder="2.5"
              placeholderTextColor={color.inkFaint}
              style={[s.input, { flex: 1 }]}
            />
          </View>
          <Chips
            options={(['acre', 'hectare', 'gunta', 'cent'] as AreaUnit[]).map((u) => [u, t(`fert.unit_${u}`)])}
            value={unit}
            onChange={(v) => setUnit(v as AreaUnit)}
          />
          {area.length > 0 && !areaValid && <Text style={s.bad}>{t('fert.badArea')}</Text>}
          <Text style={s.note}>{t('fert.bighaNote')}</Text>
        </Step>

        <Step n={4} icon="flask-outline" label={t('fert.soilTest')}>
          <Chips
            options={[['yes', t('fert.haveSoilTest')], ['no', t('fert.noSoilTest')]]}
            value={hasSoilTest === null ? null : hasSoilTest ? 'yes' : 'no'}
            onChange={(v) => setHasSoilTest(v === 'yes')}
          />
          {hasSoilTest === false && <Text style={s.note}>{t('fert.noSoilTestNote')}</Text>}
          {hasSoilTest === true && <Text style={s.note}>{t('fert.soilTestPending')}</Text>}
        </Step>
      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + space.md }]}>
        <Pressable
          onPress={calculate}
          disabled={!ready || busy}
          style={[s.cta, (!ready || busy) && s.ctaOff]}
          accessibilityState={{ disabled: !ready || busy }}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.ctaText}>{t('fert.calculate')}</Text>}
        </Pressable>
      </View>

      <PickerModal
        visible={picker === 'state'}
        title={t('fert.pickState')}
        items={INDIAN_STATES.map((x) => ({ key: x, label: x }))}
        onPick={(k) => { setState(k); setPicker(null); }}
        onClose={() => setPicker(null)}
      />
      <PickerModal
        visible={picker === 'crop'}
        title={t('fert.pickCrop')}
        items={(crops ?? []).map((c) => ({ key: c.slug, label: cropName(c) }))}
        onPick={(k) => { setCrop((crops ?? []).find((c) => c.slug === k) ?? null); setPicker(null); }}
        onClose={() => setPicker(null)}
      />
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

function Select({ value, on, onPress }: { value: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={s.select} accessibilityRole="button">
      <Text style={[s.selectText, !on && { color: color.inkFaint }]}>{value}</Text>
      <MaterialCommunityIcons name="chevron-down" size={22} color={color.inkMuted} />
    </Pressable>
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

function PickerModal({
  visible, title, items, onPick, onClose,
}: {
  visible: boolean; title: string;
  items: { key: string; label: string }[];
  onPick: (k: string) => void; onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.modal}>
        <View style={s.modalHead}>
          <Pressable onPress={onClose} hitSlop={12}>
            <MaterialCommunityIcons name="close" size={26} color={color.ink} />
          </Pressable>
          <Text style={s.title}>{title}</Text>
        </View>
        <ScrollView>
          {items.map((it) => (
            <Pressable key={it.key} onPress={() => onPick(it.key)} style={s.modalRow}>
              <Text style={s.modalRowText}>{it.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Modal>
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

  select: {
    minHeight: 56, borderWidth: 1.5, borderColor: color.line, borderRadius: radius.md,
    paddingHorizontal: space.lg, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', backgroundColor: color.bg,
  },
  selectText: { ...type.body, color: color.ink },
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

  // Normal flex sibling, NOT absolute: an overlaying footer hid step 4 and
  // swallowed taps meant for the soil-test chips.
  footer: {
    padding: space.lg, backgroundColor: color.surface,
    borderTopWidth: 1, borderTopColor: color.line,
  },
  cta: {
    minHeight: 60, borderRadius: radius.md, backgroundColor: color.green,
    alignItems: 'center', justifyContent: 'center',
  },
  ctaOff: { opacity: 0.4 },
  ctaText: { ...type.title, color: '#fff' },

  modal: { flex: 1, backgroundColor: color.surface, paddingTop: 48 },
  modalHead: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  modalRow: { minHeight: 60, justifyContent: 'center', paddingHorizontal: space.lg, borderBottomWidth: 1, borderBottomColor: color.line },
  modalRowText: { ...type.body, color: color.ink },
});
