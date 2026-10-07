import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, hit, radius, space, type } from '@fc/tokens';

/**
 * Android 15+ forces edge-to-edge, so a plain padded View puts content under
 * the status bar and the gesture pill. Insets, not a fixed padding.
 */
export function Screen({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        s.screen,
        { paddingTop: space.xl + insets.top, paddingBottom: space.xl + insets.bottom },
      ]}
    >
      {children}
    </View>
  );
}

export function Title({ children }: { children: React.ReactNode }) {
  return <Text style={s.title}>{children}</Text>;
}
export function Sub({ children }: { children: React.ReactNode }) {
  return <Text style={s.sub}>{children}</Text>;
}

export function Button({
  label, onPress, disabled, busy, variant = 'primary', style,
}: {
  label: string; onPress: () => void; disabled?: boolean; busy?: boolean;
  variant?: 'primary' | 'ghost'; style?: ViewStyle;
}) {
  const off = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        s.btn,
        variant === 'ghost' && s.btnGhost,
        off && s.btnOff,
        pressed && !off && s.btnPressed,
        style,
      ]}
    >
      {busy
        ? <ActivityIndicator color={variant === 'ghost' ? color.green : '#fff'} />
        : <Text style={[s.btnText, variant === 'ghost' && s.btnGhostText]}>{label}</Text>}
    </Pressable>
  );
}

export function Field(props: React.ComponentProps<typeof TextInput> & { label?: string }) {
  const { label, style, ...rest } = props;
  return (
    <View style={{ gap: space.sm }}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={color.inkFaint}
        style={[s.input, style]}
        {...rest}
      />
    </View>
  );
}

export function ErrorText({ children }: { children?: string | null }) {
  if (!children) return null;
  return <Text style={s.error} accessibilityLiveRegion="polite">{children}</Text>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg, padding: space.xl, gap: space.lg },
  title: { ...type.display, color: color.ink },
  sub: { ...type.body, color: color.inkMuted },
  label: { ...type.label, color: color.inkMuted },
  input: {
    height: hit.inputHeight, borderWidth: 1.5, borderColor: color.line, borderRadius: radius.md,
    paddingHorizontal: space.lg, backgroundColor: color.surface, ...type.body, color: color.ink,
  },
  btn: {
    height: hit.buttonHeight, borderRadius: radius.md, backgroundColor: color.green,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl,
  },
  btnPressed: { backgroundColor: color.greenDark },
  btnOff: { opacity: 0.45 },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: color.green },
  btnText: { ...type.bodyStrong, color: '#fff' },
  btnGhostText: { color: color.green },
  error: { ...type.body, color: color.danger },
});
