import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  AREA_UNITS, AccuracyBand, AreaUnit, Measurement, formatArea, formatPerimetre, fromSqm, unitLabel,
} from '@fc/geo';
import { color, radius, space, type } from '@fc/tokens';

const BAND_COLOR: Record<AccuracyBand, string> = {
  good: color.success, fair: color.warning, poor: color.danger, unknown: color.inkFaint,
};

export default function MeasurementPanel({
  measurement, unit, onUnitChange, accuracy, band, selfIntersecting, children,
}: {
  measurement: Measurement;
  unit: AreaUnit;
  onUnitChange: (u: AreaUnit) => void;
  accuracy: number | null;
  band: AccuracyBand;
  selfIntersecting: boolean;
  children?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const [picking, setPicking] = useState(false);
  const m = measurement;
  const enough = m.pointCount >= 3;

  return (
    <View style={s.sheet}>
      <View style={s.grip} />

      <View style={s.headRow}>
        <Text style={s.label}>{t('land.area')}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t('land.unit')}: ${unitLabel(unit)}`}
          onPress={() => setPicking(true)}
          style={s.unitBtn}
        >
          <Text style={s.unitBtnText}>{unitLabel(unit)} ▾</Text>
        </Pressable>
      </View>

      <Text style={s.big}>{enough ? formatArea(m.areaSquareMeters, unit) : '—'}</Text>

      {enough && (
        <Text style={s.secondary}>
          {[
            unit !== 'acre' && `${fromSqm(m.areaSquareMeters, 'acre').toFixed(3)} acres`,
            unit !== 'cent' && `${fromSqm(m.areaSquareMeters, 'cent').toFixed(1)} cents`,
            unit !== 'gunta' && `${fromSqm(m.areaSquareMeters, 'gunta').toFixed(1)} guntas`,
          ].filter(Boolean).join('  ·  ')}
        </Text>
      )}

      <View style={s.statRow}>
        <Stat k={t('land.perimeter')} v={enough ? formatPerimetre(m.perimeterMeters, true) : '—'} />
        <Stat k={t('land.points')} v={String(m.pointCount)} />
        <Stat
          k={t('land.accuracy')}
          v={accuracy == null ? '—' : `±${Math.round(accuracy)} m`}
          color={BAND_COLOR[band]}
        />
      </View>

      {band === 'poor' && <Text style={s.warn}>{t('land.poorAccuracy')}</Text>}
      {selfIntersecting && <Text style={s.warn}>{t('land.crossing')}</Text>}
      {!enough && <Text style={s.hint}>{t('land.needThree')}</Text>}

      <Text style={s.disclaimer}>{t('land.disclaimer')}</Text>

      {children}

      <Modal visible={picking} transparent animationType="fade" onRequestClose={() => setPicking(false)}>
        <Pressable style={s.backdrop} onPress={() => setPicking(false)}>
          <View style={s.menu}>
            {AREA_UNITS.map((u) => (
              <Pressable
                key={u}
                accessibilityRole="radio"
                accessibilityState={{ selected: u === unit }}
                onPress={() => { onUnitChange(u); setPicking(false); }}
                style={[s.menuRow, u === unit && s.menuRowOn]}
              >
                <Text style={[s.menuText, u === unit && s.menuTextOn]}>{unitLabel(u)}</Text>
                <Text style={s.menuValue}>
                  {fromSqm(m.areaSquareMeters, u).toLocaleString(undefined, { maximumFractionDigits: 3 })}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function Stat({ k, v, color: c }: { k: string; v: string; color?: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={s.statKey}>{k}</Text>
      <Text style={[s.statVal, c ? { color: c } : null]}>{v}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  sheet: {
    backgroundColor: color.surface,
    borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
    paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.lg,
    gap: space.sm,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: -3 },
    elevation: 12,
  },
  grip: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: color.line, marginBottom: space.xs },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { ...type.label, color: color.inkMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  unitBtn: {
    paddingHorizontal: space.md, paddingVertical: space.sm,
    borderRadius: radius.sm, borderWidth: 1.5, borderColor: color.line, backgroundColor: color.bg,
  },
  unitBtnText: { ...type.label, color: color.ink },
  big: { ...type.display, fontSize: 36, lineHeight: 42, color: color.greenDark },
  secondary: { ...type.label, color: color.inkMuted },
  statRow: { flexDirection: 'row', gap: space.md, marginTop: space.xs },
  statKey: { ...type.caption, color: color.inkFaint },
  statVal: { ...type.bodyStrong, color: color.ink },
  warn: { ...type.label, color: color.danger },
  hint: { ...type.label, color: color.inkMuted },
  disclaimer: { ...type.caption, color: color.inkFaint },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: space.xl },
  menu: { backgroundColor: color.surface, borderRadius: radius.lg, overflow: 'hidden' },
  menuRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: space.lg, minHeight: 60, borderBottomWidth: 1, borderBottomColor: color.line,
  },
  menuRowOn: { backgroundColor: color.greenSoft },
  menuText: { ...type.body, color: color.ink },
  menuTextOn: { color: color.greenDark, fontWeight: '700' },
  menuValue: { ...type.label, color: color.inkMuted },
});
