import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { Outcome, outcomeFor, parseScanned, suspicion } from './qr-code';

export type ResolveInput = {
  raw: string;
  /** Anonymous device id. There is no login; this is not a user. */
  deviceId?: string;
  latitude?: number;
  longitude?: number;
};

export type ResolveResult = {
  outcome: Outcome | 'not_ours';
  type?: 'PRODUCT_BATCH' | 'EQUIPMENT';
  /** Safe, server-authored detail for the UI. Never the raw scanned string. */
  detail?: Record<string, unknown>;
  warning?: { kind: string; message: string };
  /** What the app should do next. The client switches on this, not on payload shape. */
  action?: 'show_product' | 'show_equipment' | 'none';
};

@Injectable()
export class QrService {
  private readonly log = new Logger(QrService.name);

  constructor(private prisma: PrismaService) {}

  async resolve(input: ResolveInput): Promise<ResolveResult> {
    const parsed = parseScanned(input.raw);

    // Not one of ours, or not a code at all. Log it (the counts are useful) and
    // stop. We never navigate to a scanned URL — that is the phishing path.
    if (parsed.kind !== 'fc') {
      await this.recordScan({ ...input, rawCode: input.raw?.slice(0, 512) ?? '', outcome: 'unknown' });
      return {
        outcome: 'not_ours',
        action: 'none',
        warning: {
          kind: parsed.kind === 'foreign' ? 'foreign_code' : 'unreadable',
          message: 'This code is not from Farmer’s Choice.',
        },
      };
    }

    const tag = await this.prisma.qrTag.findUnique({ where: { code: parsed.code } });
    const outcome = outcomeFor(tag);

    const village = input.latitude != null && input.longitude != null
      ? await this.nearestVillageId(input.latitude, input.longitude)
      : null;

    await this.recordScan({
      ...input,
      rawCode: input.raw,
      tagId: tag?.id ?? null,
      outcome,
      villageId: village,
      deviceId: input.deviceId,
    });

    if (!tag || outcome !== 'genuine') {
      return {
        outcome,
        action: 'none',
        warning: {
          kind: outcome,
          message:
            outcome === 'revoked' ? 'This batch has been recalled. Do not use it.'
            : outcome === 'expired' ? 'This code has expired.'
            : 'We do not recognise this code.',
        },
      };
    }

    const payload = (tag.payload ?? {}) as Record<string, unknown>;

    if (tag.type === 'EQUIPMENT') {
      return { outcome, type: tag.type, action: 'show_equipment', detail: payload };
    }

    const history = await this.history(tag.id);
    const flag = suspicion(history);
    return {
      outcome,
      type: tag.type,
      action: 'show_product',
      detail: { ...payload, scanCount: history.scanCount, firstScanAt: history.firstScanAt },
      warning: flag.suspicious
        ? {
            kind: flag.reason!,
            message:
              'This code has been scanned in several places. It may be a copied label — check with the seller.',
          }
        : undefined,
    };
  }

  /** Scans are append-only; the history is what makes counterfeits visible. */
  private async recordScan(d: {
    rawCode: string; tagId?: string | null; deviceId?: string;
    outcome: Outcome; latitude?: number; longitude?: number; villageId?: string | null;
  }) {
    try {
      await this.prisma.qrScan.create({
        data: {
          rawCode: d.rawCode,
          tagId: d.tagId ?? null,
          userId: null, // no login
          deviceId: d.deviceId ?? null,
          outcome: d.outcome,
          latitude: d.latitude ?? null,
          longitude: d.longitude ?? null,
          villageId: d.villageId ?? null,
        },
      });
    } catch (e) {
      // Logging a scan must never break the scan itself.
      this.log.warn(`could not record scan: ${e}`);
    }
  }

  private async history(tagId: string) {
    const rows = await this.prisma.qrScan.findMany({
      where: { tagId },
      select: { villageId: true, scannedAt: true },
      orderBy: { scannedAt: 'asc' },
    });
    const villages = rows.map((r) => r.villageId).filter(Boolean) as string[];
    const districts = villages.length
      ? await this.prisma.location.findMany({
          where: { id: { in: [...new Set(villages)] } },
          select: { parent: { select: { parentId: true } } },
        })
      : [];
    const districtIds = new Set(districts.map((d) => d.parent?.parentId).filter(Boolean));
    return {
      scanCount: rows.length,
      districtCount: districtIds.size,
      firstScanAt: rows[0]?.scannedAt ?? null,
    };
  }

  private async nearestVillageId(lat: number, lng: number): Promise<string | null> {
    const hit = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "Location"
      WHERE level = 'VILLAGE' AND centroid IS NOT NULL
        AND ST_DWithin(centroid, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, 25000)
      ORDER BY centroid <-> ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
      LIMIT 1`;
    return hit[0]?.id ?? null;
  }
}
