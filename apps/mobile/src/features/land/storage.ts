import AsyncStorage from '@react-native-async-storage/async-storage';
import { LatLng, Measurement, measurePolygon } from '@fc/geo';

/**
 * Saved measurements live on the device.
 *
 * There is no login, so there is no account to attach them to and nothing to
 * sync to. If accounts come back, this file gains a push/pull and the shape
 * below becomes the API payload unchanged.
 */

const KEY = 'fc.measurements.v1';

export type SavedMeasurement = {
  id: string;
  name: string;
  coordinates: LatLng[];
  areaSquareMeters: number;
  areaSquareFeet: number;
  acres: number;
  cents: number;
  hectares: number;
  guntas: number;
  perimeterMeters: number;
  /** Best GPS accuracy seen while measuring, in metres. null when drawn by hand. */
  accuracyMetres: number | null;
  method: 'draw' | 'walk';
  createdAt: string;
  updatedAt: string;
};

export function buildSaved(
  name: string,
  coordinates: LatLng[],
  method: 'draw' | 'walk',
  accuracyMetres: number | null,
  existing?: SavedMeasurement,
): SavedMeasurement {
  // Recomputed from the coordinates rather than trusting whatever the screen
  // last rendered -- the points are the record, the numbers are derived.
  const m: Measurement = measurePolygon(coordinates);
  const now = new Date().toISOString();
  return {
    id: existing?.id ?? `m_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim() || 'Land',
    coordinates,
    areaSquareMeters: m.areaSquareMeters,
    areaSquareFeet: m.areaSquareFeet,
    acres: m.acres,
    cents: m.cents,
    hectares: m.hectares,
    guntas: m.guntas,
    perimeterMeters: m.perimeterMeters,
    accuracyMetres,
    method,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

/**
 * Throws when storage can't be read. The write paths use this, never the
 * forgiving list below: writing back an empty list after a failed read would
 * replace every saved field with one.
 */
async function readAll(): Promise<SavedMeasurement[]> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function listMeasurements(): Promise<SavedMeasurement[]> {
  try {
    return (await readAll()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    // Corrupt or unreadable storage must not take the screen down.
    return [];
  }
}

export async function saveMeasurement(m: SavedMeasurement): Promise<SavedMeasurement[]> {
  const rows = await readAll();
  const next = [m, ...rows.filter((r) => r.id !== m.id)];
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export async function deleteMeasurement(id: string): Promise<SavedMeasurement[]> {
  const rows = (await readAll()).filter((r) => r.id !== id);
  await AsyncStorage.setItem(KEY, JSON.stringify(rows));
  return rows;
}
