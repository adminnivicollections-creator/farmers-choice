import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ScanKind } from '../../lib/qr';

/** Recent scans, stored on the device. Real history -- never seeded with examples. */
export type ScanRecord = {
  id: string;
  title: string;
  /** What the code held. Missing on records saved by older versions. */
  kind?: ScanKind;
  /** What to open again from the list; only for codes that open something. */
  href?: string;
  at: string;
};

const KEY = 'fc.scans.v1';
const MAX = 50;

export async function listScans(): Promise<ScanRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function addScan(r: Omit<ScanRecord, 'id' | 'at'>): Promise<ScanRecord[]> {
  const rows = await listScans();
  const next = [{ ...r, id: `s_${Date.now().toString(36)}`, at: new Date().toISOString() }, ...rows].slice(0, MAX);
  try { await AsyncStorage.setItem(KEY, JSON.stringify(next)); } catch { /* history is a nicety */ }
  return next;
}
