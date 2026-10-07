import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/** 10.0.2.2 is how the Android emulator reaches the host machine's localhost. */
const DEV_HOST = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';
const BUILT_IN_BASE = process.env.EXPO_PUBLIC_API_BASE ?? DEV_HOST;
const BASE_KEY = 'fc.apiBase';

/**
 * Overridable at runtime. Testing on a real handset means the API moves with
 * whatever network the laptop is on; rebuilding an APK for each address wastes
 * everyone's afternoon.
 */
let currentBase = BUILT_IN_BASE;

export const API_BASE_DEFAULT = BUILT_IN_BASE;
export const getApiBase = () => currentBase;

export async function loadApiBase() {
  try {
    const saved = await AsyncStorage.getItem(BASE_KEY);
    if (saved) currentBase = saved;
  } catch { /* keep the built-in */ }
  return currentBase;
}

export async function setApiBase(url: string) {
  const clean = url.trim().replace(/\/+$/, '');
  currentBase = clean || BUILT_IN_BASE;
  try {
    if (clean) await AsyncStorage.setItem(BASE_KEY, clean);
    else await AsyncStorage.removeItem(BASE_KEY);
  } catch { /* in-memory override still applies this session */ }
  return currentBase;
}

/** Health probe so the address can be checked before it is relied on. */
export async function pingApi(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(`${url.replace(/\/+$/, '')}/v1/fertilizer/crops`, { signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

const ACCESS = 'fc.access';
const REFRESH = 'fc.refresh';

export async function saveTokens(accessToken: string, refreshToken: string) {
  await AsyncStorage.multiSet([[ACCESS, accessToken], [REFRESH, refreshToken]]);
}
export async function clearTokens() {
  await AsyncStorage.multiRemove([ACCESS, REFRESH]);
}
export async function getAccess() {
  try { return await AsyncStorage.getItem(ACCESS); } catch { return null; }
}

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const DEVICE = 'fc.device';

/** Random per-install id. Not an account, not tied to a phone number. */
export async function deviceId(): Promise<string> {
  try {
    let id = await AsyncStorage.getItem(DEVICE);
    if (!id) {
      id = `d_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      await AsyncStorage.setItem(DEVICE, id);
    }
    return id;
  } catch {
    return 'd_unknown';
  }
}

/**
 * Without this, a request to an unreachable host hangs for minutes on Android.
 * The screen that fired it looks frozen and never recovers -- which is exactly
 * how the QR scanner appeared to do nothing at all.
 */
const REQUEST_TIMEOUT_MS = 12_000;

export class TimeoutError extends Error {
  constructor() { super('timeout'); }
}

async function raw(path: string, init: RequestInit = {}, token?: string | null) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${currentBase}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch (e: any) {
    throw e?.name === 'AbortError' ? new TimeoutError() : e;
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = Array.isArray(body?.message) ? body.message[0] : body?.message;
    throw new ApiError(res.status, msg ?? 'Request failed');
  }
  return body;
}

/** Authenticated call with one transparent refresh-and-retry on 401. */
async function auth(path: string, init: RequestInit = {}): Promise<any> {
  const token = await getAccess();
  try {
    return await raw(path, init, token);
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 401) throw e;
    const refreshToken = await AsyncStorage.getItem(REFRESH);
    if (!refreshToken) throw e;
    const next = await raw('/v1/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }) });
    await saveTokens(next.accessToken, next.refreshToken);
    return raw(path, init, next.accessToken);
  }
}

const raw_ = raw;

export const api = {
  requestOtp: (phone: string) =>
    raw('/v1/auth/otp/request', { method: 'POST', body: JSON.stringify({ phone }) }),

  verifyOtp: (phone: string, code: string) =>
    raw('/v1/auth/otp/verify', { method: 'POST', body: JSON.stringify({ phone, code }) }),

  searchVillages: (q: string, lang: string) =>
    raw(`/v1/locations/search?q=${encodeURIComponent(q)}&lang=${lang}`),

  resolveVillage: (lat: number, lng: number, lang: string) =>
    raw(`/v1/locations/resolve?lat=${lat}&lng=${lng}&lang=${lang}`),

  me: () => auth('/v1/me'),

  fertCrops: () => raw_('/v1/fertilizer/crops'),
  fertProducts: () => raw_('/v1/fertilizer/products'),
  fertCalculate: (body: Record<string, unknown>) =>
    raw_('/v1/fertilizer/calculate', { method: 'POST', body: JSON.stringify(body) }),

  /**
   * Raw scanned string goes to the server; the server decides what it means.
   * No login -- an anonymous install id is sent so the counterfeit heuristic can
   * still tell one person scanning twice from two people in two places.
   */
  resolveQr: async (raw: string, coords?: { latitude: number; longitude: number }) =>
    raw_('/v1/qr/resolve', {
      method: 'POST',
      body: JSON.stringify({ raw, deviceId: await deviceId(), ...coords }),
    }),

  updateMe: (patch: Record<string, unknown>) =>
    auth('/v1/me', { method: 'PATCH', body: JSON.stringify(patch) }),
};
