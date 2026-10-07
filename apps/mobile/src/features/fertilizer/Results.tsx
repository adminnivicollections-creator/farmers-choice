import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, radius, space, type } from '@fc/tokens';

/**
 * Two completely separate states. When the database has no verified
 * recommendation the screen says so plainly -- it never degrades into a
 * guess, a "typical" figure, or a greyed-out estimate.
 */
export default function Results({
  result, crop, area, hasSoilTest, onBack, onClose,
}: {
  result: any; crop: string; area: string; hasSoilTest: boolean;
  onBack: () => void; onClose: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [showWorking, setShowWorking] = useState(false);

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.head}>
        <Pressable onPress={onBack} hitSlop={12}>
          <MaterialCommunityIcons name="arrow-left" size={28} color={color.ink} />
        </Pressable>
        <Text style={s.title}>{t('fert.yourPlan')}</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: insets.bottom + space.xl, gap: space.lg }}>
        {!result.available ? (
          <View style={s.unavailable}>
            <MaterialCommunityIcons name="information-outline" size={44} color={color.warning} />
            <Text style={s.unavailableTitle}>{result.message}</Text>
            {(result.suggestions ?? []).map((sug: string) => (
              <View key={sug} style={s.sugRow}>
                <MaterialCommunityIcons name="arrow-right" size={16} color={color.greenDark} />
                <Text style={s.sugText}>{sug}</Text>
              </View>
            ))}
            <Text style={s.unavailableWhy}>{t('fert.whyUnavailable')}</Text>
          </View>
        ) : (
          <>
            <View style={s.summary}>
              <Fact icon="sprout" k={t('fert.crop')} v={crop} />
              <Fact icon="map-marker" k={t('fert.location')} v={result.region} />
              <Fact icon="ruler-square" k={t('fert.land')} v={area} />
              <Fact
                icon="flask-outline"
                k={t('fert.soilTest')}
                v={hasSoilTest ? t('fert.haveSoilTest') : t('fert.generalRec')}
              />
            </View>

            <Text style={s.section}>{t('fert.nutrientNeed')}</Text>
            <View style={s.npkRow}>
              <Npk label="N" kg={result.requirement.n} />
              <Npk label="P₂O₅" kg={result.requirement.p2o5} />
              <Npk label="K₂O" kg={result.requirement.k2o} />
            </View>

            <Text style={s.section}>{t('fert.fertilizers')}</Text>
            {result.blends[0].doses.map((d: any) => (
              <View key={d.product.id} style={s.doseRow}>
                <View style={s.doseIcon}>
                  <MaterialCommunityIcons name="sack" size={22} color={color.greenDark} />
                </View>
                <Text style={s.doseName}>{d.product.name}</Text>
                <Text style={s.doseKg}>{d.kg.toFixed(1)} kg</Text>
              </View>
            ))}
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>{t('fert.total')}</Text>
              <Text style={s.totalKg}>{result.blends[0].totalKg.toFixed(1)} kg</Text>
            </View>
            {result.blends[0].totalCost == null && (
              <Text style={s.note}>{t('fert.noPrices')}</Text>
            )}

            <Text style={s.section}>{t('fert.application')}</Text>
            {result.schedule ? (
              result.schedule.map((st: any) => (
                <View key={st.stage} style={s.stage}>
                  <Text style={s.stageName}>
                    {st.stage}
                    {st.daysAfterSowing ? ` · ${t('fert.day')} ${st.daysAfterSowing}` : ''}
                  </Text>
                  {st.doses.map((d: any) => (
                    <Text key={d.product} style={s.stageDose}>{d.product} — {d.kg.toFixed(1)} kg</Text>
                  ))}
                </View>
              ))
            ) : (
              <Text style={s.note}>{t('fert.noTiming')}</Text>
            )}

            <Pressable onPress={() => setShowWorking((v) => !v)} style={s.workingToggle}>
              <Text style={s.workingToggleText}>{t('fert.howCalculated')}</Text>
              <MaterialCommunityIcons
                name={showWorking ? 'chevron-up' : 'chevron-down'}
                size={22}
                color={color.greenDark}
              />
            </Pressable>
            {showWorking && (
              <View style={s.working}>
                <Text style={s.workingLine}>
                  {t('fert.recPerHa')}: N {result.perHectare.n} · P₂O₅ {result.perHectare.p2o5} · K₂O {result.perHectare.k2o} kg/ha
                </Text>
                <Text style={s.workingLine}>
                  {t('fert.fieldArea')}: {result.hectares.toFixed(4)} ha
                </Text>
                <Text style={s.workingLine}>
                  {t('fert.adjusted')}: N {result.requirement.n.toFixed(1)} · P₂O₅ {result.requirement.p2o5.toFixed(1)} · K₂O {result.requirement.k2o.toFixed(1)} kg
                </Text>
                {result.blends[0].workings.map((w: string, i: number) => (
                  <Text key={i} style={s.workingLine}>• {w}</Text>
                ))}
              </View>
            )}

            <View style={s.source}>
              <Text style={s.sourceTitle}>{t('fert.source')}</Text>
              <SourceRow k={t('fert.organisation')} v={result.source.organisation} />
              <SourceRow k={t('fert.document')} v={result.source.document} />
              <SourceRow k={t('fert.region')} v={result.source.region} />
              <SourceRow k={t('fert.recType')} v={result.recommendationType} />
              <SourceRow k={t('fert.verifiedOn')} v={new Date(result.source.verifiedOn).toLocaleDateString()} />
              <SourceRow k={t('fert.version')} v={result.source.version} />
            </View>

            <Text style={s.disclaimer}>{result.disclaimer}</Text>
          </>
        )}

        <Pressable onPress={onClose} style={s.ghost}>
          <Text style={s.ghostText}>{t('scan.close')}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const Fact = ({ icon, k, v }: { icon: any; k: string; v: string }) => (
  <View style={s.factRow}>
    <MaterialCommunityIcons name={icon} size={18} color={color.greenDark} />
    <Text style={s.factK}>{k}</Text>
    <Text style={s.factV}>{v}</Text>
  </View>
);

const Npk = ({ label, kg }: { label: string; kg: number }) => (
  <View style={s.npk}>
    <Text style={s.npkLabel}>{label}</Text>
    <Text style={s.npkKg}>{kg.toFixed(1)}</Text>
    <Text style={s.npkUnit}>kg</Text>
  </View>
);

const SourceRow = ({ k, v }: { k: string; v: string }) => (
  <View style={s.srcRow}>
    <Text style={s.srcK}>{k}</Text>
    <Text style={s.srcV}>{v}</Text>
  </View>
);

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.surface },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  title: { ...type.display, fontSize: 24, color: color.greenDark },

  unavailable: {
    backgroundColor: '#FDF6E6', borderWidth: 1.5, borderColor: color.warning,
    borderRadius: radius.lg, padding: space.lg, gap: space.md, alignItems: 'flex-start',
  },
  unavailableTitle: { ...type.heading, color: color.ink },
  unavailableWhy: { ...type.caption, color: color.inkMuted, marginTop: space.sm },
  sugRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  sugText: { ...type.body, color: color.ink },

  summary: { backgroundColor: color.bg, borderRadius: radius.lg, padding: space.lg, gap: space.sm },
  factRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  factK: { ...type.caption, color: color.inkMuted, width: 80 },
  factV: { ...type.label, color: color.ink, flex: 1 },

  section: { ...type.heading, color: color.ink, marginTop: space.sm },
  npkRow: { flexDirection: 'row', gap: space.md },
  npk: { flex: 1, backgroundColor: color.greenSoft, borderRadius: radius.md, padding: space.lg, alignItems: 'center' },
  npkLabel: { ...type.label, color: color.greenDark },
  npkKg: { ...type.display, fontSize: 26, color: color.greenDark },
  npkUnit: { ...type.caption, color: color.inkMuted },

  doseRow: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    backgroundColor: color.bg, borderRadius: radius.md, padding: space.md,
  },
  doseIcon: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: color.greenSoft, alignItems: 'center', justifyContent: 'center' },
  doseName: { ...type.bodyStrong, color: color.ink, flex: 1 },
  doseKg: { ...type.price, color: color.greenDark },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space.md },
  totalLabel: { ...type.bodyStrong, color: color.inkMuted },
  totalKg: { ...type.bodyStrong, color: color.ink },

  stage: { backgroundColor: color.bg, borderRadius: radius.md, padding: space.md, gap: 2 },
  stageName: { ...type.bodyStrong, color: color.greenDark },
  stageDose: { ...type.label, color: color.ink },

  workingToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: space.md, borderTopWidth: 1, borderBottomWidth: 1, borderColor: color.line,
  },
  workingToggleText: { ...type.bodyStrong, color: color.greenDark },
  working: { gap: space.sm, backgroundColor: color.bg, borderRadius: radius.md, padding: space.md },
  workingLine: { ...type.caption, color: color.ink, lineHeight: 20 },

  source: { backgroundColor: color.bg, borderRadius: radius.md, padding: space.lg, gap: space.sm },
  sourceTitle: { ...type.bodyStrong, color: color.ink },
  srcRow: { flexDirection: 'row', gap: space.md },
  srcK: { ...type.caption, color: color.inkMuted, width: 96 },
  srcV: { ...type.caption, color: color.ink, flex: 1 },

  note: { ...type.caption, color: color.inkMuted },
  disclaimer: { ...type.caption, color: color.inkFaint, lineHeight: 18 },
  ghost: { minHeight: 56, alignItems: 'center', justifyContent: 'center', marginTop: space.md },
  ghostText: { ...type.label, color: color.green },
});
