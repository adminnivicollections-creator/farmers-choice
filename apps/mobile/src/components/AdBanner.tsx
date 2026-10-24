import React from 'react';
import { View, StyleSheet } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { BANNER_UNIT_ID } from '../lib/ads';

/**
 * A banner for list screens, where the farmer is browsing rather than waiting
 * on an answer. Reserves no space until an ad actually loads, so a blank or
 * unfilled slot leaves no gap in the layout.
 */
export default function AdBanner() {
  const [loaded, setLoaded] = React.useState(false);
  return (
    <View style={loaded ? s.wrap : undefined}>
      <BannerAd
        unitId={BANNER_UNIT_ID}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        onAdLoaded={() => setLoaded(true)}
        onAdFailedToLoad={() => setLoaded(false)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 8 },
});
