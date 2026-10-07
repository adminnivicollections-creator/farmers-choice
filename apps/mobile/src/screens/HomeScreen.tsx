import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, radius, space, type } from '@fc/tokens';
import { api } from '../lib/api';
import { Weather, fetchWeather } from '../lib/weather';

export type Feature = 'scan' | 'land' | 'fertilizer' | 'cropdoctor';

const BANNER = require('../../assets/home-banner.png');
const LOGO = require('../../assets/logo.png');

type Tool = {
  key: Feature;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  sub: string;
  tint: string;
};

const TOOLS: Tool[] = [
  { key: 'scan',        icon: 'qrcode-scan',     title: 'features.scan', sub: 'features.scanSub', tint: color.greenSoft },
  { key: 'land',        icon: 'vector-square',   title: 'features.land', sub: 'features.landSub', tint: color.greenSoft },
  { key: 'fertilizer',  icon: 'sack',            title: 'features.fert', sub: 'features.fertSub', tint: color.soilSoft },
  { key: 'cropdoctor',  icon: 'leaf-circle',     title: 'features.doctor', sub: 'features.doctorSub', tint: color.greenSoft },
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

  // Real location and real weather, or nothing. No invented values.
  useEffect(() => {
    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') return;
      try {
        const pos = await Location.getLastKnownPositionAsync()
          ?? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!pos) return;
        const { latitude, longitude } = pos.coords;
        fetchWeather(latitude, longitude).then(setWeather);
        api.resolveVillage(latitude, longitude, i18n.language)
          .then((r: any) => setVillage(r?.village?.name ?? null))
          .catch(() => {});
      } catch { /* no fix; header shows the fallback */ }
    })();
  }, [i18n.language]);

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
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <View style={s.metaRow}>
              <MaterialCommunityIcons name="map-marker" size={16} color={color.greenDark} />
              <Text style={s.metaText}>{village ?? t('home.setVillage')}</Text>
            </View>
            <View style={s.metaRow}>
              <MaterialCommunityIcons
                name={weather ? 'weather-sunny' : 'weather-cloudy'}
                size={16}
                color={weather ? color.star : color.inkFaint}
              />
              <Text style={s.metaText}>
                {weather ? `${weather.tempC}°C · ${weather.label}` : '—'}
              </Text>
            </View>
          </View>
        </View>

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
              <View style={[s.iconBox, { backgroundColor: tool.tint }]}>
                <MaterialCommunityIcons name={tool.icon} size={28} color={color.greenDark} />
              </View>
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
            icon="weather-sunny"
            tint="#EAF3FB"
            iconColor={color.star}
            label={t('home.weather')}
            value={weather ? `${weather.tempC}°C` : '—'}
            note={weather ? weather.label : t('home.noWeather')}
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
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
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
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { ...type.caption, color: color.inkMuted },

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
