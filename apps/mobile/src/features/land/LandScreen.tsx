import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Linking, Modal, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import MapView, { MapPressEvent, Marker, Polygon, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AccuracyBand, AreaUnit, DEFAULT_GPS_FILTER, LatLng, WalkRecorder, accuracyBand,
} from '@fc/geo';
import { color, radius, space, type } from '@fc/tokens';
import MeasurementPanel from './MeasurementPanel';
import { useBoundary } from './useBoundary';
import { SavedMeasurement, buildSaved, saveMeasurement } from './storage';
import { showInterstitial } from '../../lib/ads';
import { getApiBase, pingApi } from '../../lib/api';

type Mode = 'draw' | 'walk';
type PermState = 'checking' | 'rationale' | 'granted' | 'denied' | 'blocked';

const GHATKESAR = { latitude: 17.4516, longitude: 78.6862, latitudeDelta: 0.01, longitudeDelta: 0.01 };

export default function LandScreen({
  onClose, onOpenSaved, initial,
}: {
  onClose: () => void;
  onOpenSaved: () => void;
  initial?: SavedMeasurement | null;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const map = useRef<MapView>(null);

  const [perm, setPerm] = useState<PermState>('checking');
  const [here, setHere] = useState<(LatLng & { accuracy: number | null }) | null>(null);
  const [mode, setMode] = useState<Mode>('draw');
  /** null = not checked yet. Offline, satellite tiles cannot load at all. */
  const [online, setOnline] = useState<boolean | null>(null);
  const [unit, setUnit] = useState<AreaUnit>('acre'); // what a Guntur farmer actually thinks in
  const [walking, setWalking] = useState(false);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState(initial?.name ?? '');
  const [bestAccuracy, setBestAccuracy] = useState<number | null>(null);

  const b = useBoundary(initial?.coordinates ?? []);
  const recorder = useRef(new WalkRecorder(DEFAULT_GPS_FILTER));
  const watcher = useRef<Location.LocationSubscription | null>(null);

  // --- permission + current position -------------------------------------
  useEffect(() => {
    (async () => {
      // Check without prompting. The prompt comes after the explanation.
      const r = await Location.getForegroundPermissionsAsync();
      if (r.status === 'granted') { setPerm('granted'); return; }
      setPerm(r.canAskAgain ? 'rationale' : 'blocked');
    })();
    return () => { watcher.current?.remove(); };
  }, []);

  useEffect(() => {
    if (perm !== 'granted') return;
    let alive = true;
    pingApi(getApiBase()).then((ok) => {
      if (!alive) return;
      setOnline(ok);
      // Without tiles the map is a blank void and 'draw' is unusable, so
      // start in the mode that still works instead of looking broken.
      if (!ok) setMode('walk');
    });
    return () => { alive = false; };
  }, [perm]);

  useEffect(() => {
    if (perm !== 'granted') return;
    let sub: Location.LocationSubscription | null = null;
    (async () => {
      try {
        sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 1, timeInterval: 1000 },
          (p) => {
            const fix = { latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy };
            setHere(fix);
            setBestAccuracy((prev) =>
              p.coords.accuracy == null ? prev : prev == null ? p.coords.accuracy : Math.min(prev, p.coords.accuracy));
          },
        );
      } catch { /* no fix available; the panel shows "—" */ }
    })();
    return () => { sub?.remove(); };
  }, [perm]);

  // Centre once on the first fix, or on a saved boundary.
  const centred = useRef(false);
  useEffect(() => {
    if (centred.current || !map.current) return;
    if (initial?.coordinates.length) {
      centred.current = true;
      map.current.fitToCoordinates(initial.coordinates, {
        edgePadding: { top: 120, right: 80, bottom: 380, left: 80 }, animated: false,
      });
    } else if (here) {
      centred.current = true;
      map.current.animateToRegion({ ...here, latitudeDelta: 0.004, longitudeDelta: 0.004 }, 600);
    }
  }, [here, initial]);

  // --- walk mode ----------------------------------------------------------
  const startWalk = useCallback(async () => {
    recorder.current.reset();
    b.replaceAll([]);
    setWalking(true);
    watcher.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 1, timeInterval: 1000 },
      (p) => {
        const r = recorder.current.add({
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
          accuracy: p.coords.accuracy,
          timestamp: p.timestamp,
        });
        if (r.accepted) b.replaceAll([...recorder.current.points]);
      },
    );
  }, [b]);

  const finishWalk = useCallback(() => {
    watcher.current?.remove();
    watcher.current = null;
    setWalking(false);
    b.replaceAll([...recorder.current.points]);
  }, [b]);

  // --- draw mode ----------------------------------------------------------
  const onMapPress = (e: MapPressEvent) => {
    if (mode !== 'draw' || walking) return;
    b.addPoint(e.nativeEvent.coordinate);
  };

  const recentre = () => {
    if (here) map.current?.animateToRegion({ ...here, latitudeDelta: 0.004, longitudeDelta: 0.004 }, 500);
  };

  const band: AccuracyBand = accuracyBand(here?.accuracy ?? null);

  async function doSave() {
    const saved = buildSaved(
      name, b.points, mode, mode === 'walk' ? bestAccuracy : (here?.accuracy ?? null), initial ?? undefined,
    );
    await saveMeasurement(saved);
    setNaming(false);
    onOpenSaved();
    // Ads go after value, never before it. The measurement is saved and on
    // screen; this never delays anything the farmer asked for.
    showInterstitial().catch(() => {});
  }

  // --- permission screens -------------------------------------------------
  if (perm === 'checking') {
    return <Centered><ActivityIndicator size="large" color={color.green} /></Centered>;
  }
  if (perm !== 'granted') {
    return (
      <Centered>
        <MaterialCommunityIcons
          name={perm === 'blocked' ? 'map-marker-off-outline' : 'map-marker-radius-outline'}
          size={56}
          color={color.green}
          style={{ marginBottom: space.md }}
        />
        <Text style={s.permTitle}>
          {perm === 'rationale' ? t('land.rationaleTitle') : t('land.permTitle')}
        </Text>
        <Text style={s.permBody}>
          {perm === 'blocked' ? t('land.permBlocked')
            : perm === 'rationale' ? t('land.rationaleBody')
            : t('land.permBody')}
        </Text>
        {perm === 'rationale' && <Text style={s.permPrivacy}>{t('land.rationalePrivacy')}</Text>}
        <Pressable
          style={s.primaryBtn}
          onPress={() => perm === 'blocked'
            ? Linking.openSettings()
            : Location.requestForegroundPermissionsAsync().then((r) =>
                setPerm(r.status === 'granted' ? 'granted' : r.canAskAgain ? 'denied' : 'blocked'))}
        >
          <Text style={s.primaryBtnText}>
            {perm === 'blocked' ? t('scan.openSettings') : t('land.permGrant')}
          </Text>
        </Pressable>
        <Pressable onPress={onClose} style={s.ghostBtn}><Text style={s.ghostBtnText}>{t('scan.close')}</Text></Pressable>
      </Centered>
    );
  }

  return (
    <View style={s.root}>
      {online === false && (
        <View style={[s.offlineBar, { top: insets.top + 76 }]}>
          <MaterialCommunityIcons name="wifi-off" size={16} color="#7A4B00" />
          <Text style={s.offlineText}>{t('land.offline')}</Text>
        </View>
      )}

      <MapView
        ref={map}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        initialRegion={GHATKESAR}
        mapType="satellite"       // field boundaries are visible on imagery, not on a road map
        showsUserLocation
        showsMyLocationButton={false}
        onPress={onMapPress}
      >
        {b.points.length >= 3 && (
          <Polygon
            coordinates={b.points}
            strokeColor={color.green}
            strokeWidth={3}
            fillColor="rgba(27,122,62,0.28)"
          />
        )}
        {b.points.length === 2 && (
          <Polyline coordinates={b.points} strokeColor={color.green} strokeWidth={3} />
        )}
        {b.points.map((p, i) => (
          <Marker
            key={`${i}-${p.latitude}-${p.longitude}`}
            coordinate={p}
            draggable={!walking}
            onDragEnd={(e) => b.movePoint(i, e.nativeEvent.coordinate)}
            onPress={() => !walking && b.deletePoint(i)}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <View style={s.handle}><Text style={s.handleText}>{i + 1}</Text></View>
          </Marker>
        ))}
      </MapView>

      {/* top bar */}
      <View style={[s.topBar, { paddingTop: insets.top + space.sm }]}>
        <Pressable onPress={onClose} style={s.round} accessibilityLabel={t('scan.close')}>
          <Text style={s.roundText}>✕</Text>
        </Pressable>
        <View style={s.segment}>
          <Seg label={t('land.draw')} on={mode === 'draw'} onPress={() => !walking && setMode('draw')} />
          <Seg label={t('land.walk')} on={mode === 'walk'} onPress={() => setMode('walk')} />
        </View>
        <Pressable onPress={onOpenSaved} style={s.round} accessibilityLabel={t('land.saved')}>
          <Text style={s.roundText}>☰</Text>
        </Pressable>
      </View>

      <Pressable onPress={recentre} style={[s.locateBtn, { bottom: 360 }]} accessibilityLabel={t('land.recentre')}>
        <Text style={s.roundText}>◎</Text>
      </Pressable>

      {walking && (
        <View style={[s.walkChip, { top: insets.top + 80 }]}>
          <Text style={s.walkChipText}>
            {t('land.recording', {
              points: b.points.length,
              metres: Math.round(recorder.current.distanceWalkedMetres),
            })}
          </Text>
        </View>
      )}

      <View style={s.bottom}>
        <MeasurementPanel
          measurement={b.measurement}
          unit={unit}
          onUnitChange={setUnit}
          accuracy={here?.accuracy ?? null}
          band={band}
          selfIntersecting={b.selfIntersecting}
        >
          <View style={[s.actions, { paddingBottom: insets.bottom }]}>
            {mode === 'walk' ? (
              walking
                ? <Btn label={t('land.finish')} onPress={finishWalk} primary />
                : <Btn label={t('land.start')} onPress={startWalk} primary />
            ) : (
              <Text style={s.drawHint}>{t('land.drawHint')}</Text>
            )}

            <View style={s.actionRow}>
              <Btn label={t('land.undo')} onPress={b.undo} disabled={!b.canUndo} small />
              <Btn label={t('land.redo')} onPress={b.redo} disabled={!b.canRedo} small />
              <Btn label={t('land.clear')} onPress={b.clear} disabled={!b.points.length} small />
              <Btn
                label={t('land.save')}
                onPress={() => setNaming(true)}
                disabled={b.measurement.pointCount < 3}
                primary
                small
              />
            </View>
          </View>
        </MeasurementPanel>
      </View>

      <Modal visible={naming} transparent animationType="fade" onRequestClose={() => setNaming(false)}>
        <View style={s.backdrop}>
          <View style={s.dialog}>
            <Text style={s.dialogTitle}>{t('land.nameIt')}</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t('land.namePlaceholder')}
              placeholderTextColor={color.inkFaint}
              style={s.input}
              autoFocus
              maxLength={60}
            />
            <View style={s.actionRow}>
              <Btn label={t('scan.close')} onPress={() => setNaming(false)} small />
              <Btn label={t('land.save')} onPress={doSave} primary small />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <View style={[s.root, s.centered]}>{children}</View>;
}

function Seg({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.seg, on && s.segOn]} accessibilityRole="button"
      accessibilityState={{ selected: on }}>
      <Text style={[s.segText, on && s.segTextOn]}>{label}</Text>
    </Pressable>
  );
}

function Btn({
  label, onPress, primary, disabled, small,
}: { label: string; onPress: () => void; primary?: boolean; disabled?: boolean; small?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.btn, small && s.btnSmall, primary ? s.btnPrimary : s.btnGhost,
        disabled && s.btnOff, pressed && !disabled && s.btnPressed,
      ]}
    >
      <Text style={[s.btnText, primary ? s.btnTextPrimary : s.btnTextGhost]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  centered: { alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.md },

  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space.lg, gap: space.md,
  },
  round: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: color.surface,
    alignItems: 'center', justifyContent: 'center', elevation: 4,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 6,
  },
  roundText: { fontSize: 20, color: color.ink },

  segment: { flexDirection: 'row', backgroundColor: color.surface, borderRadius: radius.pill, padding: 4, elevation: 4 },
  seg: { paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.pill, minHeight: 40, justifyContent: 'center' },
  segOn: { backgroundColor: color.green },
  segText: { ...type.label, color: color.inkMuted },
  segTextOn: { color: '#fff', fontWeight: '700' },

  locateBtn: {
    position: 'absolute', right: space.lg,
    width: 52, height: 52, borderRadius: 26, backgroundColor: color.surface,
    alignItems: 'center', justifyContent: 'center', elevation: 4,
  },

  walkChip: {
    position: 'absolute', alignSelf: 'center',
    backgroundColor: color.greenDark, paddingHorizontal: space.lg, paddingVertical: space.sm,
    borderRadius: radius.pill,
  },
  walkChipText: { ...type.label, color: '#fff' },

  handle: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: color.surface,
    borderWidth: 3, borderColor: color.green, alignItems: 'center', justifyContent: 'center',
  },
  handleText: { fontSize: 12, fontWeight: '700', color: color.greenDark },

  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  actions: { gap: space.sm, marginTop: space.sm },
  actionRow: { flexDirection: 'row', gap: space.sm },
  drawHint: { ...type.caption, color: color.inkMuted, textAlign: 'center' },

  btn: { flex: 1, minHeight: 56, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.md },
  btnSmall: { minHeight: 48 },
  btnPrimary: { backgroundColor: color.green },
  btnGhost: { backgroundColor: color.bg, borderWidth: 1.5, borderColor: color.line },
  btnPressed: { opacity: 0.85 },
  btnOff: { opacity: 0.4 },
  btnText: { ...type.label, fontWeight: '600' },
  btnTextPrimary: { color: '#fff' },
  btnTextGhost: { color: color.ink },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: space.xl },
  dialog: { backgroundColor: color.surface, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  dialogTitle: { ...type.title, color: color.ink },
  input: {
    minHeight: 56, borderWidth: 1.5, borderColor: color.line, borderRadius: radius.md,
    paddingHorizontal: space.lg, ...type.body, color: color.ink, backgroundColor: color.bg,
  },

  permTitle: { ...type.title, color: color.ink, textAlign: 'center' },
  offlineBar: { position: 'absolute', left: space.lg, right: space.lg, zIndex: 20,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFF3D6', borderColor: '#E8C77A', borderWidth: 1,
    borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 12 },
  offlineText: { flex: 1, color: '#7A4B00', fontSize: 13, lineHeight: 18 },
  permPrivacy: { marginTop: space.sm, textAlign: 'center', color: color.inkMuted, fontSize: 13, lineHeight: 19 },
  permBody: { ...type.body, color: color.inkMuted, textAlign: 'center' },
  primaryBtn: {
    minHeight: 56, borderRadius: radius.md, backgroundColor: color.green,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl, alignSelf: 'stretch',
  },
  primaryBtnText: { ...type.bodyStrong, color: '#fff' },
  ghostBtn: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  ghostBtnText: { ...type.label, color: color.green },
});
