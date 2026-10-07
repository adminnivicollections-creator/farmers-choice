import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { space } from '@fc/tokens';
import { api } from '../lib/api';
import { Button, ErrorText, Field, Screen, Sub, Title } from '../components/ui';

/** Without this the Home greeting renders "Namaskaram,  garu" with a hole in it. */
export default function NameScreen({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true); setErr(null);
    try { await api.updateMe({ name: name.trim() }); onDone(); }
    catch { setErr(t('common.error')); }
    finally { setBusy(false); }
  }

  return (
    <Screen>
      <Title>{t('name.title')}</Title>
      <Sub>{t('name.subtitle')}</Sub>
      <View style={{ marginTop: space.lg }}>
        <Field
          label={t('name.label')}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          maxLength={80}
          placeholder={t('name.placeholder')}
        />
      </View>
      <ErrorText>{err}</ErrorText>
      <View style={{ flex: 1 }} />
      <Button label={t('name.save')} onPress={save} disabled={name.trim().length < 2} busy={busy} />
    </Screen>
  );
}
