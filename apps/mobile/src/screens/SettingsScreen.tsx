import React, { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, radius, space, type } from '@fc/tokens';
import { API_BASE_DEFAULT, getApiBase, pingApi, setApiBase } from '../lib/api';
import { LANGS, Lang, setLang } from '../i18n';
import { PRIVACY_URL } from '../lib/links';

const VERSION: string = require('../../app.json').expo.version;

/** Settings, including the server address so testing on a handset does not
 *  require a new build every time the laptop changes network. */
export default function SettingsScreen({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const [url, setUrl] = useState(getApiBase());
  const [state, setState] = useState<'idle' | 'checking' | 'ok' | 'bad'>('idle');

  useEffect(() => { setUrl(getApiBase()); }, []);

  async function save() {
    setState('checking');
    const next = await setApiBase(url);
    setUrl(next);
    setState((await pingApi(next)) ? 'ok' : 'bad');
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.head}>
        <Pressable onPress={onClose} hitSlop={12}>
          <MaterialCommunityIcons name="arrow-left" size={28} color={color.ink} />
        </Pressable>
        <Text style={s.title}>{t('tabs.profile')}</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
        <Text style={s.label}>{t('settings.language')}</Text>
        <View style={s.row}>
          {LANGS.map((l) => (
            <Pressable
              key={l}
              onPress={() => setLang(l as Lang)}
              style={[s.chip, i18n.language === l && s.chipOn]}
            >
              <Text style={[s.chipText, i18n.language === l && s.chipTextOn]}>{t(`lang.${l}`)}</Text>
            </Pressable>
          ))}
        </View>

        {__DEV__ && <>
        <Text style={s.label}>{t('settings.server')}</Text>
        <TextInput
          value={url}
          onChangeText={(v) => { setUrl(v); setState('idle'); }}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder={API_BASE_DEFAULT}
          placeholderTextColor={color.inkFaint}
          style={s.input}
        />
        <Text style={s.hint}>{t('settings.serverHint', { base: API_BASE_DEFAULT })}</Text>

        <Pressable onPress={save} style={s.btn}>
          <Text style={s.btnText}>
            {state === 'checking' ? t('settings.checking') : t('settings.saveTest')}
          </Text>
        </Pressable>

        {state === 'ok' && <Text style={s.ok}>{t('settings.reachable')}</Text>}
        {state === 'bad' && <Text style={s.bad}>{t('settings.unreachable')}</Text>}
        </>}

        {/* about: required credits, and the not-a-government-app disclosure */}
        <View style={s.about}>
          <Text style={s.label}>{t('settings.about')}</Text>
          <Text style={s.aboutText}>{t('settings.disclaimer')}</Text>
          <Text style={s.hint}>{t('settings.sources')}</Text>
          {PRIVACY_URL ? (
            <Pressable onPress={() => Linking.openURL(PRIVACY_URL).catch(() => {})} hitSlop={8}>
              <Text style={s.link}>{t('settings.privacy')}</Text>
            </Pressable>
          ) : null}
          <Text style={s.hint}>{t('settings.version', { v: VERSION })}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.surface },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  title: { ...type.display, fontSize: 24, color: color.greenDark },
  label: { ...type.heading, color: color.ink },
  row: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  chip: {
    minHeight: 48, paddingHorizontal: space.lg, justifyContent: 'center',
    borderRadius: radius.pill, borderWidth: 1.5, borderColor: color.line, backgroundColor: color.bg,
  },
  chipOn: { backgroundColor: color.green, borderColor: color.green },
  chipText: { ...type.label, color: color.ink },
  chipTextOn: { color: '#fff', fontWeight: '700' },
  input: {
    minHeight: 56, borderWidth: 1.5, borderColor: color.line, borderRadius: radius.md,
    paddingHorizontal: space.lg, ...type.body, color: color.ink, backgroundColor: color.bg,
  },
  hint: { ...type.caption, color: color.inkMuted },
  about: {
    gap: space.sm, padding: space.lg, borderRadius: radius.lg,
    backgroundColor: color.bg, borderWidth: 1, borderColor: color.line,
  },
  aboutText: { ...type.label, color: color.ink },
  link: { ...type.label, color: color.green, fontWeight: '700', textDecorationLine: 'underline' },
  btn: {
    minHeight: 56, borderRadius: radius.md, backgroundColor: color.green,
    alignItems: 'center', justifyContent: 'center',
  },
  btnText: { ...type.bodyStrong, color: '#fff' },
  ok: { ...type.label, color: color.success },
  bad: { ...type.label, color: color.danger },
});
