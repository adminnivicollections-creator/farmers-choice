import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, radius, space, type } from '@fc/tokens';
import { getApiBase, api, ApiError, TimeoutError } from '../lib/api';
import { ScanRecord, addScan, listScans } from '../features/scan/history';
import { initAds } from '../lib/ads';

type Foreign = {
  kind: 'url' | 'upi' | 'phone' | 'email' | 'wifi' | 'geo' | 'text';
  display: string;
  openable: boolean;
  host?: string;
  suspiciousHost?: boolean;
  payee?: string;
  payeeName?: string;
  amount?: string;
};

type Resolved = {
  outcome: 'genuine' | 'unknown' | 'revoked' | 'expired' | 'not_ours';
  type?: 'PRODUCT_BATCH' | 'EQUIPMENT';
  detail?: Record<string, any>;
  foreign?: Foreign;
  warning?: { kind: string; message: string };
};

export default function ScanScreen({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [perm, requestPerm] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [torch, setTorch] = useState(false);
  const [result, setResult] = useState<Resolved | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** What the camera actually read. Shown even when the lookup fails, so a
   *  failed scan can be told apart from a failed network. */
  const [scannedText, setScannedText] = useState<string | null>(null);
  const [recent, setRecent] = useState<ScanRecord[]>([]);
  const locked = useRef(false);

  useEffect(() => { listScans().then(setRecent); initAds(); }, []);

  const onScanned = useCallback(async ({ data }: { data: string }) => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError(null);
    setScannedText(data);
    try {
      // Resolve FIRST, advertise second. If the lookup fails the farmer sees the
      // error immediately instead of sitting through an ad for nothing.
      const r: Resolved = await api.resolveQr(data);

      setResult(r);
      const title =
        r.detail?.productName ?? r.detail?.equipmentName ??
        (r.outcome === 'not_ours' ? t('scan.foreign') : t('scan.unknownItem'));
      setRecent(await addScan({ title, outcome: r.outcome, type: r.type }));
    } catch (e) {
      // Distinguish "server said no" from "could not reach the server at all" --
      // on a phone the second is far more likely and needs a different fix.
      setError(
        e instanceof ApiError
          ? e.message
          : `${e instanceof TimeoutError ? t('scan.timeout') : t('scan.offline')} (${getApiBase()})`,
      );
      // Unlock so the next scan is possible without leaving the screen.
      locked.current = false;
    } finally {
      setBusy(false);
    }
  }, [t]);

  const scanAgain = () => {
    setResult(null);
    setError(null);
    setScannedText(null);
    locked.current = false;
  };

  if (!perm) return <View style={s.root}><ActivityIndicator color={color.green} style={{ marginTop: 80 }} /></View>;

  if (!perm.granted) {
    const blocked = !perm.canAskAgain;
    return (
      <View style={[s.root, { paddingTop: insets.top }]}>
        <Header onClose={onClose} />
        <View style={s.permBox}>
          <MaterialCommunityIcons name="camera-off-outline" size={56} color={color.inkFaint} />
          <Text style={s.permTitle}>{t('scan.permTitle')}</Text>
          <Text style={s.permBody}>{blocked ? t('scan.permDenied') : t('scan.permBody')}</Text>
          <Pressable
            style={s.primary}
            onPress={() => (blocked ? Linking.openSettings() : requestPerm())}
          >
            <Text style={s.primaryText}>{blocked ? t('scan.openSettings') : t('scan.permGrant')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <Header onClose={onClose} />

      <ScrollView contentContainerStyle={{ paddingBottom: space.xl }} showsVerticalScrollIndicator={false}>
        {/* camera */}
        <View style={s.camera}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            enableTorch={torch}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={result || busy ? undefined : onScanned}
          />
          <Pressable
            onPress={() => setTorch((v) => !v)}
            accessibilityLabel={t('scan.torch')}
            style={[s.torch, torch && s.torchOn]}
          >
            <MaterialCommunityIcons
              name={torch ? 'flashlight' : 'flashlight-off'}
              size={20}
              color={torch ? color.ink : '#fff'}
            />
          </Pressable>

          {!result && <Reticle />}

          <View style={s.camFoot}>
            <MaterialCommunityIcons name="camera-outline" size={18} color="#fff" />
            <Text style={s.camFootText}>
              {busy ? t('scan.checking') : t('scan.point')}
            </Text>
          </View>
        </View>

        {/* result */}
        {(result || error) && (
          <View style={s.resultWrap}>
            {error ? (
              <View style={s.errBox}>
                <Text style={s.error}>{error}</Text>
                {scannedText && (
                  <>
                    <Text style={s.readLabel}>{t('scan.cameraRead')}</Text>
                    <Text style={s.readValue} selectable numberOfLines={3}>{scannedText}</Text>
                    <Text style={s.readNote}>{t('scan.cameraOk')}</Text>
                  </>
                )}
              </View>
            ) : <ResultCard r={result!} />}
            <Pressable style={s.primary} onPress={scanAgain}>
              <Text style={s.primaryText}>{t('scan.scanAgain')}</Text>
            </Pressable>
          </View>
        )}

        {/* why scan */}
        {!result && (
          <View style={s.why}>
            <MaterialCommunityIcons name="shield-check" size={44} color={color.green} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={s.whyTitle}>{t('scan.why')}</Text>
              {[t('scan.why1'), t('scan.why2'), t('scan.why3')].map((line) => (
                <View key={line} style={s.whyRow}>
                  <MaterialCommunityIcons name="check" size={16} color={color.green} />
                  <Text style={s.whyText}>{line}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* recent */}
        <View style={s.sectionHead}>
          <Text style={s.sectionTitle}>{t('scan.recent')}</Text>
        </View>
        {recent.length === 0 ? (
          <Text style={s.none}>{t('scan.none')}</Text>
        ) : (
          recent.slice(0, 5).map((r) => <RecentRow key={r.id} r={r} />)
        )}
      </ScrollView>
    </View>
  );
}

function Header({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={s.header}>
      <Pressable onPress={onClose} hitSlop={12} accessibilityLabel={t('scan.close')}>
        <MaterialCommunityIcons name="arrow-left" size={28} color={color.ink} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={s.title}>{t('scan.title')}</Text>
        <Text style={s.subtitle}>{t('scan.subtitle')}</Text>
      </View>
      <View style={s.headerMark}>
        <MaterialCommunityIcons name="leaf" size={22} color={color.green} />
      </View>
    </View>
  );
}

function Reticle() {
  return (
    <View style={s.reticleWrap} pointerEvents="none">
      <View style={[s.corner, s.tl]} />
      <View style={[s.corner, s.tr]} />
      <View style={[s.corner, s.bl]} />
      <View style={[s.corner, s.br]} />
    </View>
  );
}

function ResultCard({ r }: { r: Resolved }) {
  const { t } = useTranslation();
  const good = r.outcome === 'genuine';
  // A code we did not issue is simply content: neutral styling, no verdict.
  const plain = r.outcome === 'not_ours' && !!r.foreign;
  const d = r.detail ?? {};
  return (
    <View style={[s.result, plain ? s.resultPlain : good ? s.resultGood : s.resultBad]}>
      {!plain && (
        <View style={s.resultHead}>
          <MaterialCommunityIcons
            name={good ? 'check-decagram' : 'alert-decagram'}
            size={26}
            color={good ? color.green : color.danger}
          />
          <Text style={[s.resultBadge, { color: good ? color.greenDark : color.danger }]}>
            {good ? t('scan.genuine') : t(`scan.${r.outcome}`, { defaultValue: r.outcome })}
          </Text>
        </View>
      )}

      {good && <Text style={s.resultName}>{d.productName ?? d.equipmentName}</Text>}
      {good && r.type === 'PRODUCT_BATCH' && (
        <>
          <Row k="Manufacturer" v={d.manufacturer} />
          <Row k="Batch" v={d.batchNo} />
          <Row k="Packed" v={d.packedOn} />
          <Row k="Pack size" v={d.packSize} />
          <Row k="Times scanned" v={d.scanCount != null ? String(d.scanCount) : undefined} />
        </>
      )}
      {good && r.type === 'EQUIPMENT' && <Row k="Owner" v={d.ownerName} />}
      {r.warning && <Text style={s.resultWarn}>{r.warning.message}</Text>}
      {r.foreign && <ForeignBlock f={r.foreign} />}
    </View>
  );
}

/**
 * A code that is not ours. We show what it holds so the farmer can judge it,
 * and open nothing by ourselves: tapping is always their explicit choice, and
 * only ever for http/https.
 */
function ForeignBlock({ f }: { f: Foreign }) {
  const { t } = useTranslation();

  const label = {
    url: t('scan.f.website'), upi: t('scan.f.payment'), phone: t('scan.f.phone'),
    email: t('scan.f.email'), wifi: t('scan.f.wifi'), geo: t('scan.f.place'),
    text: t('scan.f.text'),
  }[f.kind];

  return (
    <View style={s.foreign}>
      <Text style={s.foreignKind}>{label}</Text>

      {f.kind === 'upi' ? (
        <>
          <Row k={t('scan.f.payTo')} v={f.payeeName ?? f.payee} />
          {f.payeeName && f.payee ? <Row k={t('scan.f.upiId')} v={f.payee} /> : null}
          <Row k={t('scan.f.amount')} v={f.amount ? `₹${f.amount}` : undefined} />
          <Text style={s.foreignDanger}>{t('scan.f.payWarn')}</Text>
        </>
      ) : (
        <>
          {f.host ? <Text style={s.foreignHost}>{f.host}</Text> : null}
          <Text style={s.foreignText} numberOfLines={4}>{f.display}</Text>
        </>
      )}

      {f.suspiciousHost && <Text style={s.foreignDanger}>{t('scan.f.lookalike')}</Text>}

      {f.openable && (
        <Pressable
          style={s.foreignOpen}
          onPress={() => {
            Alert.alert(t('scan.f.confirmTitle'), t('scan.f.confirmBody', { host: f.host ?? '' }), [
              { text: t('common.cancel'), style: 'cancel' },
              { text: t('scan.f.open'), onPress: () => Linking.openURL(f.display).catch(() => {}) },
            ]);
          }}
        >
          <MaterialCommunityIcons name="open-in-new" size={18} color={color.greenDark} />
          <Text style={s.foreignOpenText}>{t('scan.f.openIn')}</Text>
        </Pressable>
      )}
    </View>
  );
}

function Row({ k, v }: { k: string; v?: string }) {
  if (!v) return null;
  return (
    <View style={s.row}>
      <Text style={s.rowK}>{k}</Text>
      <Text style={s.rowV}>{v}</Text>
    </View>
  );
}

function RecentRow({ r }: { r: ScanRecord }) {
  const { t } = useTranslation();
  const good = r.outcome === 'genuine';
  return (
    <View style={s.recent}>
      <View style={s.recentIcon}>
        <MaterialCommunityIcons
          name={r.type === 'EQUIPMENT' ? 'tractor-variant' : 'sprout'}
          size={24}
          color={color.greenDark}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.recentTitle} numberOfLines={1}>{r.title}</Text>
        <Text style={s.recentMeta}>
          {new Date(r.at).toLocaleDateString()} · {new Date(r.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
      <View style={[s.pill, good ? s.pillGood : s.pillBad]}>
        <MaterialCommunityIcons
          name={good ? 'check-circle' : 'alert-circle'}
          size={14}
          color={good ? color.greenDark : color.danger}
        />
        <Text style={[s.pillText, { color: good ? color.greenDark : color.danger }]}>
          {good ? t('scan.genuine') : r.outcome}
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.surface },

  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  title: { ...type.display, fontSize: 26, color: color.greenDark },
  subtitle: { ...type.label, color: color.inkMuted },
  headerMark: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: color.greenSoft,
    alignItems: 'center', justifyContent: 'center',
  },

  camera: {
    marginHorizontal: space.lg, height: 320, borderRadius: radius.lg,
    overflow: 'hidden', backgroundColor: '#000',
  },
  torch: {
    position: 'absolute', top: space.md, right: space.md,
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  torchOn: { backgroundColor: color.star },
  camFoot: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm,
    paddingVertical: space.md, backgroundColor: 'rgba(0,0,0,0.5)',
  },
  camFootText: { ...type.label, color: '#fff' },

  reticleWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  corner: { position: 'absolute', width: 46, height: 46, borderColor: color.green, borderWidth: 5 },
  tl: { top: 80, left: 60, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 14 },
  tr: { top: 80, right: 60, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 14 },
  bl: { bottom: 100, left: 60, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 14 },
  br: { bottom: 100, right: 60, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 14 },

  resultWrap: { padding: space.lg, gap: space.md },
  result: { borderRadius: radius.lg, borderWidth: 2, padding: space.lg, gap: space.sm },
  resultGood: { borderColor: color.green, backgroundColor: color.greenSoft },
  resultBad: { borderColor: color.danger, backgroundColor: '#FBE9E7' },
  resultHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  resultBadge: { ...type.label, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  resultName: { ...type.title, color: color.ink },
  resultWarn: { ...type.label, color: color.danger, marginTop: space.xs },
  resultPlain: { borderColor: '#e5e3df', backgroundColor: '#fff' },
  foreign: { marginTop: 0 },
  foreignKind: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: '#6b6b6b', marginBottom: 6 },
  foreignHost: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 2 },
  foreignText: { fontSize: 13, color: '#4a4a4a', lineHeight: 19 },
  foreignDanger: { marginTop: 8, fontSize: 13, fontWeight: '700', color: color.danger, lineHeight: 19 },
  foreignOpen: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
    marginTop: 12, paddingVertical: 9, paddingHorizontal: 14, borderRadius: 8,
    borderWidth: 1, borderColor: color.green, backgroundColor: '#f1f7f2' },
  foreignOpenText: { fontSize: 14, fontWeight: '700', color: color.greenDark },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md },
  rowK: { ...type.caption, color: color.inkMuted },
  rowV: { ...type.label, color: color.ink, flexShrink: 1, textAlign: 'right' },
  error: { ...type.body, color: color.danger },
  errBox: {
    gap: space.sm, padding: space.lg, borderRadius: radius.lg,
    borderWidth: 1.5, borderColor: color.danger, backgroundColor: '#FBE9E7',
  },
  readLabel: { ...type.caption, color: color.inkMuted, marginTop: space.sm },
  readValue: { ...type.bodyStrong, color: color.ink },
  readNote: { ...type.caption, color: color.success },

  why: {
    flexDirection: 'row', alignItems: 'center', gap: space.lg,
    margin: space.lg, padding: space.lg, borderRadius: radius.lg, backgroundColor: color.greenSoft,
  },
  whyTitle: { ...type.heading, color: color.greenDark },
  whyRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  whyText: { ...type.label, color: color.ink },

  sectionHead: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.md },
  sectionTitle: { ...type.display, fontSize: 22, color: color.ink },
  none: { ...type.label, color: color.inkMuted, paddingHorizontal: space.lg },

  recent: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    marginHorizontal: space.lg, marginBottom: space.md,
    padding: space.md, borderRadius: radius.lg,
    borderWidth: 1.5, borderColor: color.line, backgroundColor: color.bg,
  },
  recentIcon: {
    width: 48, height: 48, borderRadius: radius.md, backgroundColor: color.greenSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  recentTitle: { ...type.bodyStrong, color: color.ink },
  recentMeta: { ...type.caption, color: color.inkFaint },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: space.sm, paddingVertical: 6, borderRadius: radius.pill },
  pillGood: { backgroundColor: color.greenSoft },
  pillBad: { backgroundColor: '#FBE9E7' },
  pillText: { ...type.caption, fontWeight: '700' },

  permBox: { padding: space.xl, alignItems: 'center', gap: space.md },
  permTitle: { ...type.title, color: color.ink, textAlign: 'center' },
  permBody: { ...type.body, color: color.inkMuted, textAlign: 'center' },
  primary: {
    minHeight: 56, borderRadius: radius.md, backgroundColor: color.green,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl, alignSelf: 'stretch',
  },
  primaryText: { ...type.bodyStrong, color: '#fff' },
});
