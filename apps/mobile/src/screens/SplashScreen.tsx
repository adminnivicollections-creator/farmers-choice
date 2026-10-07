import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { color, space, type } from '@fc/tokens';
import Logo from '../components/Logo';

/**
 * Opening animation: the wordmark fades up while the wheat mark draws itself in.
 * Held short on purpose -- a splash a farmer sits through twice a day is a tax,
 * not a brand moment.
 */
const HOLD_MS = 1500;

export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(18)).current;
  const mark = useRef(new Animated.Value(0.82)).current;
  const tagline = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Someone who has asked the OS to reduce motion gets the end state, not the journey.
      const reduced = await AccessibilityInfo.isReduceMotionEnabled().catch(() => false);
      if (cancelled) return;

      if (reduced) {
        fade.setValue(1); rise.setValue(0); mark.setValue(1); tagline.setValue(1);
      } else {
        Animated.sequence([
          Animated.parallel([
            Animated.timing(mark, { toValue: 1, duration: 520, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }),
            Animated.timing(fade, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            Animated.timing(rise, { toValue: 0, duration: 480, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          ]),
          Animated.timing(tagline, { toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]).start();
      }
    })();

    const t = setTimeout(onDone, HOLD_MS);
    return () => { cancelled = true; clearTimeout(t); };
  }, [fade, rise, mark, tagline, onDone]);

  return (
    <View style={s.root}>
      <Animated.View style={{ transform: [{ scale: mark }], opacity: fade }}>
        <Logo size={128} />
      </Animated.View>

      <Animated.View style={{ opacity: fade, transform: [{ translateY: rise }] }}>
        <Text style={s.word}>Farmer's</Text>
        <Text style={s.word2}>CHOICE</Text>
      </Animated.View>

      <Animated.Text style={[s.tagline, { opacity: tagline }]}>
        Better Farming · Brighter Tomorrow
      </Animated.Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.surface, alignItems: 'center', justifyContent: 'center', gap: space.md },
  word: { ...type.display, fontSize: 40, lineHeight: 46, color: color.greenDark, textAlign: 'center' },
  word2: {
    ...type.heading, color: color.soil, textAlign: 'center',
    letterSpacing: 7, marginTop: 2,
  },
  tagline: { ...type.caption, color: color.inkMuted, marginTop: space.sm, letterSpacing: 0.4 },
});
