import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { color, space, type } from '@fc/tokens';

export type Tab = 'home' | 'scan' | 'farm' | 'profile';

const TABS: { key: Tab; icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string }[] = [
  { key: 'home',    icon: 'home-variant', label: 'tabs.home' },
  { key: 'scan',    icon: 'qrcode-scan',  label: 'tabs.scan' },
  { key: 'farm',    icon: 'barn',         label: 'tabs.farm' },
  { key: 'profile', icon: 'account-outline', label: 'tabs.profile' },
];

export default function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View style={[s.bar, { paddingBottom: Math.max(insets.bottom, space.sm) }]}>
      {TABS.map((tab) => {
        const on = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={t(tab.label)}
            onPress={() => onChange(tab.key)}
            style={s.item}
          >
            <MaterialCommunityIcons
              name={tab.icon}
              size={26}
              color={on ? color.green : color.inkFaint}
            />
            <Text style={[s.label, on && s.labelOn]}>{t(tab.label)}</Text>
            {on && <View style={s.underline} />}
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: color.surface,
    borderTopWidth: 1,
    borderTopColor: color.line,
    paddingTop: space.sm,
  },
  item: { flex: 1, alignItems: 'center', gap: 2, minHeight: 56, justifyContent: 'center' },
  label: { ...type.caption, color: color.inkFaint },
  labelOn: { color: color.green, fontWeight: '700' },
  underline: { width: 28, height: 3, borderRadius: 2, backgroundColor: color.green, marginTop: 2 },
});
