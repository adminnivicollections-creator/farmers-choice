import React from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { color, space, type } from '@fc/tokens';
import { Button, Screen, Sub, Title } from '../components/ui';

/** Honest placeholder: the tile is visible but the feature is not built yet. */
export default function ComingSoonScreen({
  title, note, onClose,
}: { title: string; note: string; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center', gap: space.md }}>
        <Text style={{ ...type.display, fontSize: 48 }}>🚧</Text>
        <Title>{title}</Title>
        <Sub>{t('features.soon')}</Sub>
        <Text style={{ ...type.caption, color: color.inkFaint }}>{note}</Text>
      </View>
      <Button label={t('scan.close')} variant="ghost" onPress={onClose} />
    </Screen>
  );
}
