import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { space } from '@fc/tokens';
import { api, ApiError } from '../lib/api';
import { Button, ErrorText, Field, Screen, Sub, Title } from '../components/ui';

export default function PhoneScreen({ onSent }: { onSent: (phone: string) => void }) {
  const { t } = useTranslation();
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const digits = phone.replace(/\D/g, '');
  const looksValid = digits.length === 10 && /^[6-9]/.test(digits);

  async function send() {
    setBusy(true); setErr(null);
    try {
      await api.requestOtp(phone);
      onSent(phone);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : t('common.error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title>{t('auth.title')}</Title>
      <Sub>{t('auth.subtitle')}</Sub>
      <View style={{ marginTop: space.lg }}>
        <Field
          label={t('auth.phoneLabel')}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          autoComplete="tel"
          maxLength={13}
          placeholder="9876543210"
        />
      </View>
      <ErrorText>{err}</ErrorText>
      <View style={{ flex: 1 }} />
      <Button label={t('auth.sendCode')} onPress={send} disabled={!looksValid} busy={busy} />
    </Screen>
  );
}
