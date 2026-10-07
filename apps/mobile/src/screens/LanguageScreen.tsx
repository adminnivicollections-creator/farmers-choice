import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { color, radius, space, type } from '@fc/tokens';
import { LANGS, Lang, setLang } from '../i18n';
import { Screen, Title, Button } from '../components/ui';

export default function LanguageScreen({ onDone }: { onDone: () => void }) {
  const { t, i18n } = useTranslation();
  const current = i18n.language as Lang;

  return (
    <Screen>
      <Title>{t('lang.choose')}</Title>
      <View style={{ gap: space.md, marginTop: space.lg }}>
        {LANGS.map((l) => {
          const active = current === l;
          return (
            <Pressable
              key={l}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              onPress={() => setLang(l)}
              style={[s.opt, active && s.optOn]}
            >
              <Text style={[s.optText, active && s.optTextOn]}>{t(`lang.${l}`)}</Text>
              {active ? <Text style={s.tick}>✓</Text> : null}
            </Pressable>
          );
        })}
      </View>
      <View style={{ flex: 1 }} />
      <Button label={t('lang.continue')} onPress={onDone} />
    </Screen>
  );
}

const s = StyleSheet.create({
  opt: {
    minHeight: 64, borderRadius: radius.md, borderWidth: 2, borderColor: color.line,
    backgroundColor: color.surface, paddingHorizontal: space.lg,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  optOn: { borderColor: color.green, backgroundColor: color.greenSoft },
  optText: { ...type.title, color: color.ink },
  optTextOn: { color: color.greenDark },
  tick: { ...type.title, color: color.green },
});
