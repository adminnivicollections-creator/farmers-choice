import React, { useEffect, useRef } from 'react';
import { Animated, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { color, radius } from '@fc/tokens';

/** A light tick on every tap, so a press is felt even in bright sun. */
export function tap() {
  Haptics.selectionAsync().catch(() => { /* no vibrator: nothing to feel */ });
}

/** Pulsing placeholder while real data loads -- never a fake value. */
export function Shimmer({ style }: { style?: ViewStyle }) {
  const o = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(o, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(o, { toValue: 0.4, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [o]);
  return (
    <Animated.View
      style={[{ height: 16, borderRadius: radius.sm, backgroundColor: color.surfaceAlt, opacity: o }, style]}
    />
  );
}
