import { test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildSaved, deleteMeasurement, listMeasurements, saveMeasurement } from './storage';

afterEach(() => mock.restoreAll());

const field = buildSaved('North plot', [
  { latitude: 16.30, longitude: 80.43 },
  { latitude: 16.30, longitude: 80.44 },
  { latitude: 16.31, longitude: 80.44 },
], 'draw', null);

test('an unreadable store aborts a save instead of overwriting every field', async () => {
  mock.method(AsyncStorage, 'getItem', async () => { throw new Error('Row too big to fit into CursorWindow'); });
  const setItem = mock.method(AsyncStorage, 'setItem', async () => {});

  await assert.rejects(saveMeasurement(field));
  await assert.rejects(deleteMeasurement(field.id));
  assert.equal(setItem.mock.callCount(), 0);
});

test('a corrupt store aborts writes too, but the list screen still opens', async () => {
  mock.method(AsyncStorage, 'getItem', async () => '{not json');
  const setItem = mock.method(AsyncStorage, 'setItem', async () => {});

  await assert.rejects(saveMeasurement(field));
  assert.equal(setItem.mock.callCount(), 0);
  assert.deepEqual(await listMeasurements(), []);
});

test('a readable store keeps existing fields when saving', async () => {
  const other = { ...field, id: 'm_other', name: 'South plot' };
  mock.method(AsyncStorage, 'getItem', async () => JSON.stringify([other]));
  const setItem = mock.method(AsyncStorage, 'setItem', async () => {});

  const rows = await saveMeasurement(field);
  assert.deepEqual(rows.map((r) => r.id).sort(), [field.id, 'm_other'].sort());
  assert.equal(setItem.mock.callCount(), 1);
});
