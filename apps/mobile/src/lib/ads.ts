import {
  AdEventType, InterstitialAd, MobileAds, TestIds,
} from 'react-native-google-mobile-ads';

/**
 * Interstitial shown between a scan and its result.
 *
 * Two rules this module keeps:
 *  1. The result is NEVER blocked on an ad. If the ad fails, times out, or has
 *     not loaded, the farmer goes straight to the result.
 *  2. Ad length is the network's, not ours. AdMob interstitials are skippable
 *     after ~5s; forcing a longer unskippable ad is a policy violation.
 */

const UNIT_ID = __DEV__
  ? TestIds.INTERSTITIAL
  : (process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID ?? TestIds.INTERSTITIAL);

export const BANNER_UNIT_ID = __DEV__
  ? TestIds.BANNER
  : (process.env.EXPO_PUBLIC_ADMOB_BANNER_ID ?? TestIds.BANNER);

/** True when real ad units are configured, so we can warn loudly if not. */
export const usingTestAds =
  __DEV__ ||
  !process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID ||
  !process.env.EXPO_PUBLIC_ADMOB_BANNER_ID;

/**
 * One interstitial per session, and never on the first screen a farmer sees.
 * An ad that interrupts twice in a row is the difference between background
 * furniture and an app someone uninstalls.
 */
let shownThisSession = 0;
const MAX_PER_SESSION = 1;
export const canShowInterstitial = () => shownThisSession < MAX_PER_SESSION;

/** Never make the farmer wait longer than this for an ad to load. */
const LOAD_TIMEOUT_MS = 4000;

let preloaded: InterstitialAd | null = null;
let loading = false;
let initialised = false;

export async function initAds() {
  if (initialised) return;
  initialised = true;
  try {
    await MobileAds().initialize();
    preload();
  } catch {
    // Ads are optional. The app works without them.
  }
}

/** Fetch the next interstitial in the background so a scan isn't delayed. */
export function preload() {
  if (preloaded || loading) return;
  loading = true;
  const ad = InterstitialAd.createForAdRequest(UNIT_ID, { requestNonPersonalizedAdsOnly: false });

  const done = ad.addAdEventListener(AdEventType.LOADED, () => {
    preloaded = ad;
    loading = false;
    done();
  });
  const failed = ad.addAdEventListener(AdEventType.ERROR, () => {
    preloaded = null;
    loading = false;
    failed();
  });

  try { ad.load(); } catch { loading = false; }
}

/**
 * Show the ad if one is ready, then resolve. Resolves either way -- the caller
 * navigates to the result as soon as this settles.
 */
export function showInterstitial(): Promise<'shown' | 'skipped'> {
  if (!canShowInterstitial()) return Promise.resolve('skipped');
  const ad = preloaded;
  if (!ad) {
    preload(); // warm one for next time
    return Promise.resolve('skipped');
  }
  preloaded = null;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (how: 'shown' | 'skipped') => {
      if (settled) return;
      settled = true;
      if (how === 'shown') shownThisSession++;
      preload();
      resolve(how);
    };

    const closed = ad.addAdEventListener(AdEventType.CLOSED, () => { closed(); finish('shown'); });
    const errored = ad.addAdEventListener(AdEventType.ERROR, () => { errored(); finish('skipped'); });

    // If the ad never opens for any reason, don't strand the farmer.
    setTimeout(() => finish('skipped'), 15_000);

    try { ad.show(); } catch { finish('skipped'); }
  });
}

/** Wait briefly for a preload, for the first scan after launch. */
export function waitForPreload(): Promise<void> {
  if (preloaded) return Promise.resolve();
  preload();
  return new Promise((resolve) => {
    const started = Date.now();
    const tick = setInterval(() => {
      if (preloaded || Date.now() - started > LOAD_TIMEOUT_MS) {
        clearInterval(tick);
        resolve();
      }
    }, 200);
  });
}
