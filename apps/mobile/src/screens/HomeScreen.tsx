import React, { useCallback, useEffect, useState } from 'react';
import { Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';
import { LANGS, Lang, setLang } from '../i18n';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, radius, space, type } from '@fc/tokens';
import { Weather, fetchWeather } from '../lib/weather';

export type Feature = 'scan' | 'land' | 'fertilizer';

const FRESH_FIX_MS = 10 * 60 * 1000;
const FIX_TIMEOUT_MS = 15_000;

const BANNER = require('../../assets/home-banner.png');
const LOGO = require('../../assets/logo.png');

type Tool = {
  key: Feature;
  /** Supplied artwork. These already carry their own rounded tile and
   *  background, so no tint box is drawn behind them. */
  icon: ReturnType<typeof require>;
  title: string;
  sub: string;
  tint: string;
};

/** Short label for the header button, so it stays readable at 18px. */
const SHORT: Record<Lang, string> = { te: 'తె', hi: 'हि', en: 'EN' };

const TOOLS: Tool[] = [
  { key: 'scan',       icon: require('../../assets/icons/scan.png'),       title: 'features.scan', sub: 'features.scanSub', tint: color.greenSoft },
  { key: 'land',       icon: require('../../assets/icons/land.png'),       title: 'features.land', sub: 'features.landSub', tint: color.greenSoft },
  { key: 'fertilizer', icon: require('../../assets/icons/fertilizer.png'), title: 'features.fert', sub: 'features.fertSub', tint: color.soilSoft },
];

function greetingKey(d = new Date()): string {
  const h = d.getHours();
  if (h < 12) return 'home.morning';
  if (h < 17) return 'home.afternoon';
  return 'home.evening';
}

export default function HomeScreen({ onOpen }: { onOpen: (f: Feature) => void }) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const [village, setVillage] = useState<string | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [langOpen, setLangOpen] = useState(false);

  /** null until checked. 'blocked' = denied for good; only Settings can fix it. */
  const [locPerm, setLocPerm] = useState<'granted' | 'denied' | 'blocked' | null>(null);

  // Real location and real weather, or nothing. No invented values.
  const loadPlace = useCallback(async () => {
    try {
      // Prefer a fresh fix: an old one may be somewhere the farmer has left.
      // getCurrentPositionAsync can wait forever indoors or on a cold GPS, so
      // it is bounded, and an older fix beats a header stuck on a dash.
      const pos = await Location.getLastKnownPositionAsync({ maxAge: FRESH_FIX_MS })
        ?? await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), FIX_TIMEOUT_MS)),
        ])
        ?? await Location.getLastKnownPositionAsync();
      if (!pos) return;
      const { latitude, longitude } = pos.coords;
      fetchWeather(latitude, longitude).then(setWeather);
      // The phone's own geocoder names the place: real data, no village table.
      const [addr] = await Location.reverseGeocodeAsync({ latitude, longitude });
      setVillage(addr?.city ?? addr?.district ?? addr?.subregion ?? null);
    } catch { /* no fix or no geocoder; the header shows a dash */ }
  }, []);

  const applyPerm = useCallback((p: Location.LocationPermissionResponse) => {
    setLocPerm(p.granted ? 'granted' : p.canAskAgain ? 'denied' : 'blocked');
    if (p.granted) loadPlace();
  }, [loadPlace]);

  // Weather is the first thing Home shows, so this is where location is first
  // needed: ask once, if never asked. After a "no", only a tap asks again.
  useEffect(() => {
    (async () => {
      const p = await Location.getForegroundPermissionsAsync();
      applyPerm(p.status === 'undetermined' ? await Location.requestForegroundPermissionsAsync() : p);
    })();
  }, [applyPerm]);

  const askLocation = async () => {
    if (locPerm === 'blocked') return Linking.openSettings();
    applyPerm(await Location.requestForegroundPermissionsAsync());
  };

  return (
    <View style={s.root}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: space.xl }}
        showsVerticalScrollIndicator={false}
      >
        {/* greeting */}
        <View style={[s.header, { paddingTop: insets.top + space.md }]}>
          <Image source={LOGO} style={s.avatar} />
          <View style={{ flex: 1 }}>
            <Text style={s.greet}>{t(greetingKey())},</Text>
            <Text style={s.greetName}>{t('home.farmer')} 👋</Text>
          </View>
          <Pressable
            onPress={() => setLangOpen(true)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t('lang.choose')}
            style={s.langBtn}
          >
            <MaterialCommunityIcons name="translate" size={18} color={color.greenDark} />
            <Text style={s.langBtnText}>{SHORT[i18n.language as Lang] ?? 'EN'}</Text>
          </Pressable>

          <View style={s.meta}>
            {locPerm === 'denied' || locPerm === 'blocked' ? (
              <Pressable onPress={askLocation} hitSlop={8} accessibilityRole="button" style={s.metaRow}>
                <MaterialCommunityIcons name="map-marker-off-outline" size={16} color={color.greenDark} />
                <Text style={[s.metaText, s.metaLink]} numberOfLines={2}>{t('home.allowLocation')}</Text>
              </Pressable>
            ) : (
              <View style={s.metaRow}>
                <MaterialCommunityIcons name="map-marker" size={16} color={color.greenDark} />
                <Text style={s.metaText} numberOfLines={1}>{village ?? '—'}</Text>
              </View>
            )}
            <View style={s.metaRow}>
              <MaterialCommunityIcons
                name={(weather?.icon ?? 'weather-cloudy') as any}
                size={16}
                color={weather ? color.star : color.inkFaint}
              />
              <Text style={s.metaText}>
                {weather ? `${weather.tempC}°C · ${t(weather.labelKey)}` : '—'}
              </Text>
            </View>
          </View>
        </View>

        <Modal visible={langOpen} transparent animationType="fade" onRequestClose={() => setLangOpen(false)}>
          <Pressable style={s.sheetBg} onPress={() => setLangOpen(false)}>
            <View style={s.sheet}>
              <Text style={s.sheetTitle}>{t('lang.choose')}</Text>
              {LANGS.map((l) => (
                <Pressable
                  key={l}
                  onPress={async () => { await setLang(l); setLangOpen(false); }}
                  style={[s.langRow, i18n.language === l && s.langRowOn]}
                >
                  <Text style={[s.langRowText, i18n.language === l && s.langRowTextOn]}>{t(`lang.${l}`)}</Text>
                  {i18n.language === l && (
                    <MaterialCommunityIcons name="check" size={20} color={color.greenDark} />
                  )}
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Modal>

        {/* banner */}
        <View style={s.banner}>
          <Image source={BANNER} style={s.bannerImg} resizeMode="cover" />
          {/* left-to-right scrim: the couple sits right of centre, the copy sits left */}
          <View style={s.bannerScrim} pointerEvents="none" />
          <View style={s.bannerText}>
            <Text style={s.bannerLine1}>{t('home.bannerA')}</Text>
            <Text style={s.bannerLine2}>{t('home.bannerB')}</Text>
            <Text style={s.bannerSub}>{t('home.bannerSub')}</Text>
          </View>
        </View>

        {/* quick tools */}
        <SectionHead title={t('home.quickTools')} />
        <View style={s.grid}>
          {TOOLS.map((tool) => (
            <Pressable
              key={tool.key}
              accessibilityRole="button"
              accessibilityLabel={`${t(tool.title)}. ${t(tool.sub)}`}
              onPress={() => onOpen(tool.key)}
              style={({ pressed }) => [s.card, pressed && s.cardOn]}
            >
              <Image source={tool.icon} style={s.iconArt} resizeMode="contain" />
              <View style={s.cardTitleRow}>
                <Text style={s.cardTitle}>{t(tool.title)}</Text>
                <MaterialCommunityIcons name="chevron-right" size={22} color={color.inkFaint} />
              </View>
              <Text style={s.cardSub}>{t(tool.sub)}</Text>
            </Pressable>
          ))}
        </View>

        {/* today */}
        <SectionHead title={t('home.today')} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.strip}
        >
          <StatCard
            icon={weather?.icon ?? 'weather-cloudy'}
            tint="#EAF3FB"
            iconColor={color.star}
            label={t('home.weather')}
            value={weather ? `${weather.tempC}°C` : '—'}
            note={weather ? t(weather.labelKey) : t('home.noWeather')}
          />
          <StatCard
            icon="water"
            tint={color.greenSoft}
            iconColor={color.info}
            label={t('home.irrigation')}
            value="—"
            note={t('home.notSetUp')}
          />
          <StatCard
            icon="leaf"
            tint={color.greenSoft}
            iconColor={color.green}
            label={t('home.cropHealth')}
            value="—"
            note={t('home.notSetUp')}
          />
        </ScrollView>
      </ScrollView>
    </View>
  );
}

function SectionHead({ title }: { title: string }) {
  return (
    <View style={s.sectionHead}>
      <Text style={s.sectionTitle}>{title}</Text>
    </View>
  );
}

function StatCard({
  icon, tint, iconColor, label, value, note,
}: {
  /** Supplied artwork. These already carry their own rounded tile and
   *  background, so no tint box is drawn behind them. */
  icon: ReturnType<typeof require>;
  tint: string; iconColor: string; label: string; value: string; note: string;
}) {
  return (
    <View style={[s.stat, { backgroundColor: tint }]}>
      <MaterialCommunityIcons name={icon} size={26} color={iconColor} />
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statNote}>{note}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.surface },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    paddingHorizontal: space.lg, paddingBottom: space.md,
  },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  greet: { ...type.label, color: color.greenDark },
  greetName: { ...type.title, fontSize: 24, color: color.greenDark },
  // Capped so a long place name or label can't squeeze the greeting.
  meta: { alignItems: 'flex-end', gap: 4, flexShrink: 1, maxWidth: '36%' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { ...type.caption, color: color.inkMuted },
  metaLink: { color: color.greenDark, fontWeight: '700', textDecorationLine: 'underline' },

  banner: {
    marginHorizontal: space.lg, height: 230, borderRadius: radius.lg,
    overflow: 'hidden', backgroundColor: color.greenSoft, justifyContent: 'center',
  },
  bannerImg: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  bannerScrim: {
    position: 'absolute', top: 0, bottom: 0, left: 0, width: '68%',
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  bannerText: { padding: space.lg, maxWidth: '62%', gap: 2 },
  bannerLine1: { ...type.display, fontSize: 30, lineHeight: 34, color: color.greenDark },
  bannerLine2: { ...type.display, fontSize: 30, lineHeight: 34, color: color.green },
  bannerSub: { ...type.label, color: color.ink, marginTop: space.sm },

  sectionHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space.lg, paddingTop: space.xl, paddingBottom: space.md,
  },
  sectionTitle: { ...type.display, fontSize: 24, color: color.ink },

  grid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: space.md, paddingHorizontal: space.lg,
  },
  card: {
    width: '47.6%', minHeight: 150, borderRadius: radius.lg, padding: space.lg,
    backgroundColor: color.bg, borderWidth: 1.5, borderColor: color.line, gap: space.sm,
  },
  cardOn: { borderColor: color.green, backgroundColor: color.greenSoft },
  langBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 999, backgroundColor: color.greenSoft, marginRight: space.sm },
  langBtnText: { fontWeight: '700', color: color.greenDark, fontSize: 13 },
  sheetBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: color.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: space.lg, gap: space.sm },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: color.ink, marginBottom: space.sm },
  langRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 16, paddingHorizontal: space.md, borderRadius: radius.md, backgroundColor: color.surfaceAlt },
  langRowOn: { backgroundColor: color.greenSoft },
  langRowText: { fontSize: 17, color: color.ink },
  langRowTextOn: { fontWeight: '700', color: color.greenDark },
  iconArt: { width: 56, height: 56, marginBottom: space.sm, borderRadius: radius.md },
  iconBox: { width: 52, height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { ...type.heading, color: color.ink, flexShrink: 1 },
  cardSub: { ...type.caption, color: color.inkMuted },

  strip: { paddingHorizontal: space.lg, gap: space.md, paddingBottom: space.sm },
  stat: { width: 164, borderRadius: radius.lg, padding: space.lg, gap: 2 },
  statLabel: { ...type.caption, color: color.inkMuted, marginTop: space.sm },
  statValue: { ...type.title, color: color.ink },
  statNote: { ...type.caption, color: color.inkFaint },
});
