import React from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';

const LOGO = require('../../assets/logo.png');

/** The Farmer's Choice mark. Square source, so width == height. */
export default function Logo({ size = 96, style }: { size?: number; style?: StyleProp<ImageStyle> }) {
  return (
    <Image
      source={LOGO}
      accessibilityRole="image"
      accessibilityLabel="Farmer's Choice"
      resizeMode="contain"
      style={[{ width: size, height: size }, style]}
    />
  );
}
