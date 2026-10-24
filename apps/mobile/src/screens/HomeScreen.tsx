import React, { useCallback, useEffect, useState } from 'react';
import { Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';
import { LANGS, Lang, setLang } from '../i18n';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, radius, space, type } from '@fc/tokens';
import { Weather, fetchWeather } from '../lib/weather';
import { Shimmer, tap } from '../components/feedback';

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
  /** 'failed' offers a retry instead of a silent dash. */
  const [weatherState, setWeatherState] = useState<'loading' | 'ok' | 'failed'>('loading');
  const [langOpen, setLangOpen] = useState(false);

  /** null until checked. 'blocked' = denied for good; only Settings can fix it. */
  const [locPerm, setLocPerm] = useState<'granted' | 'denied' | 'blocked' | null>(null);

  // Real location and real weather, or nothing. No invented values.
  const loadPlace = useCallback(async () => {
    setWeatherState('loading');
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
      if (!pos) { setWeatherState('failed'); return; }
      const { latitude, longitude } = pos.coords;
      fetchWeather(latitude, longitude).then((w) => {
        setWeather(w);
        setWeatherState(w ? 'ok' : 'failed');
      });
      // The phone's own geocoder names the place: real data, no village table.
      const [addr] = await Location.reverseGeocodeAsync({ latitude, longitude });
      setVillage(addr?.city ?? addr?.district ?? addr?.subregion ?? null);
    } catch { setWeatherState((st) => (st === 'ok' ? st : 'failed')); }
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

  const needsPermission = locPerm === 'denied' || locPerm === 'blocked';

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
            <Text style={s.greetName}>{t('home.farmer')}</Text>
          </View>
          <Pressable
            onPress={() => { tap(); setLangOpen(true); }}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t('lang.choose')}
            style={s.langBtn}
          >
            <MaterialCommunityIcons name="translate" size={18} color={color.greenDark} />
            <Text style={s.langBtnText}>{SHORT[i18n.language as Lang] ?? 'EN'}</Text>
          </Pressable>
        </View>

        <Modal visible={langOpen} transparent animationType="fade" onRequestClose={() => setLangOpen(false)}>
          <Pressable style={s.sheetBg} onPress={() => setLangOpen(false)}>
            <View style={s.sheet}>
              <Text style={s.sheetTitle}>{t('lang.choose')}</Text>
              {LANGS.map((l) => (
                <Pressable
                  key={l}
                  onPress={async () => { tap(); await setLang(l); setLangOpen(false); }}
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

        {/* weather: real data, a loading pulse, a retry, or a way to allow location */}
        <Pressable
          onPress={() => {
            if (needsPermission) { tap(); askLocation(); }
            else if (weatherState === 'failed') { tap(); loadPlace(); }
          }}
          accessibilityRole="button"
          style={s.weather}
        >
          {needsPermission ? (
            <>
              <MaterialCommunityIcons name="map-marker-off-outline" size={36} color={color.greenDark} />
              <Text style={[s.weatherLabel, { flex: 1 }]}>{t('home.allowLocation')}</Text>
              <MaterialCommunityIcons name="chevron-right" size={24} color={color.greenDark} />
            </>
          ) : weatherState === 'loading' || locPerm == null ? (
            <View style={{ flex: 1, gap: space.sm }}>
              <Shimmer style={{ width: '45%', height: 28 }} />
              <Shimmer style={{ width: '70%' }} />
            </View>
          ) : weather ? (
            <>
              <MaterialCommunityIcons name={weather.icon as any} size={44} color={weather.isDay ? color.star : color.info} />
              <View style={{ flex: 1 }}>
                <Text style={s.weatherTemp}>{weather.tempC}°C</Text>
                <Text style={s.weatherLabel} numberOfLines={1}>
                  {t(weather.labelKey)}{village ? ` · ${village}` : ''}
                </Text>
              </View>
            </>
          ) : (
            <>
              <MaterialCommunityIcons name="weather-cloudy-alert" size={36} color={color.inkFaint} />
              <Text style={[s.weatherLabel, { flex: 1 }]}>{t('home.weatherFailed')}</Text>
              <MaterialCommunityIcons name="refresh" size={24} color={color.inkMuted} />
            </>
          )}
        </Pressable>

        {/* tools: one full-width row each, big targets, no empty grid slots */}
        <View style={s.tools}>
          {TOOLS.map((tool) => (
            <Pressable
              key={tool.key}
              accessibilityRole="button"
              accessibilityLabel={`${t(tool.title)}. ${t(tool.sub)}`}
              onPress={() => { tap(); onOpen(tool.key); }}
              style={({ pressed }) => [s.tool, pressed && s.toolOn]}
            >
              <Image source={tool.icon} style={s.iconArt} resizeMode="contain" />
              <View style={{ flex: 1 }}>
                <Text style={s.toolTitle}>{t(tool.title)}</Text>
                <Text style={s.toolSub}>{t(tool.sub)}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={26} color={color.inkFaint} />
            </Pressable>
          ))}
        </View>

        {/* banner, kept but out of the way of the tools */}
        <View style={s.banner}>
          <Image source={BANNER} style={s.bannerImg} resizeMode="cover" />
          <View style={s.bannerScrim} pointerEvents="none" />
          <View style={s.bannerText}>
            <Text style={s.bannerLine1}>{t('home.bannerA')}</Text>
            <Text style={s.bannerLine2}>{t('home.bannerB')}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    paddingHorizontal: space.lg, paddingBottom: space.lg,
  },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  greet: { ...type.label, color: color.inkMuted },
  greetName: { ...type.title, color: color.greenDark },

  langBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, minHeight: 44,
    borderRadius: radius.pill, backgroundColor: color.greenSoft },
  langBtnText: { fontWeight: '700', color: color.greenDark, fontSize: 15 },
  sheetBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: color.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: space.lg, gap: space.sm },
  sheetTitle: { ...type.heading, color: color.ink, marginBottom: space.sm },
  langRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    minHeight: 56, paddingHorizontal: space.md, borderRadius: radius.md, backgroundColor: color.surfaceAlt },
  langRowOn: { backgroundColor: color.greenSoft },
  langRowText: { ...type.body, color: color.ink },
  langRowTextOn: { fontWeight: '700', color: color.greenDark },

  weather: {
    flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 84,
    marginHorizontal: space.lg, padding: space.lg, borderRadius: radius.lg,
    backgroundColor: color.surface, borderWidth: 1, borderColor: color.line,
  },
  weatherTemp: { ...type.display, color: color.ink },
  weatherLabel: { ...type.label, color: color.inkMuted },

  tools: { padding: space.lg, gap: space.md },
  tool: {
    flexDirection: 'row', alignItems: 'center', gap: space.lg, minHeight: 88,
    padding: space.md, borderRadius: radius.lg,
    backgroundColor: color.surface, borderWidth: 1, borderColor: color.line,
  },
  toolOn: { borderColor: color.green, backgroundColor: color.greenSoft },
  iconArt: { width: 60, height: 60, borderRadius: radius.md },
  toolTitle: { ...type.heading, color: color.ink },
  toolSub: { ...type.caption, color: color.inkMuted, marginTop: 2 },

  banner: {
    marginHorizontal: space.lg, height: 150, borderRadius: radius.lg,
    overflow: 'hidden', backgroundColor: color.greenSoft, justifyContent: 'center',
  },
  bannerImg: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  bannerScrim: {
    position: 'absolute', top: 0, bottom: 0, left: 0, width: '62%',
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  bannerText: { padding: space.lg, maxWidth: '58%' },
  bannerLine1: { ...type.title, color: color.greenDark },
  bannerLine2: { ...type.title, color: color.green },
});
