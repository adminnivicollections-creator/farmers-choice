import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { space } from '@fc/tokens';
import { api, ApiError, saveTokens } from '../lib/api';
import { Button, ErrorText, Field, Screen, Sub, Title } from '../components/ui';

export default function OtpScreen({
  phone, onVerified, onBack,
}: { phone: string; onVerified: (profileComplete: boolean) => void; onBack: () => void }) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function verify() {
    setBusy(true); setErr(null);
    try {
      const r = await api.verifyOtp(phone, code);
      await saveTokens(r.accessToken, r.refreshToken);
      onVerified(Boolean(r.profileComplete));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : t('common.error'));
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title>{t('auth.otpTitle')}</Title>
      <Sub>{t('auth.otpSubtitle', { phone })}</Sub>
      <View style={{ marginTop: space.lg }}>
        <Field
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          autoComplete="sms-otp"
          maxLength={6}
          placeholder="------"
          style={{ fontSize: 30, letterSpacing: 10, textAlign: 'center' }}
        />
      </View>
      <ErrorText>{err}</ErrorText>
      <View style={{ flex: 1 }} />
      <Button label={t('auth.verify')} onPress={verify} disabled={code.length !== 6} busy={busy} />
      <Button label={t('auth.resend')} variant="ghost" onPress={onBack} />
    </Screen>
  );
}
