import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

type Lang = 'te' | 'hi' | 'en';

@Injectable()
export class LocationsService {
  constructor(private prisma: PrismaService) {}

  /** Type-ahead for the village picker. Matches English, Telugu and Hindi names. */
  async search(q: string, lang: Lang = 'te', limit = 20) {
    if (!q || q.trim().length < 2) return [];
    const term = q.trim();
    const rows = await this.prisma.location.findMany({
      where: {
        level: 'VILLAGE',
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { nameTe: { contains: term } },
          { nameHi: { contains: term } },
        ],
      },
      include: { parent: { include: { parent: true } } },
      take: limit,
    });
    return rows.map((r) => this.toDto(r, lang));
  }

  /**
   * Turn a GPS fix into the nearest village. Bounded at 15 km so a farmer in
   * another district doesn't get silently assigned to Ghatkesar.
   */
  async resolve(lat: number, lng: number, lang: Lang = 'te') {
    const hits = await this.prisma.$queryRaw<Array<{ id: string; metres: number }>>`
      SELECT id, (centroid <-> ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography) AS metres
      FROM "Location"
      WHERE level = 'VILLAGE' AND centroid IS NOT NULL
        AND ST_DWithin(centroid, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, 15000)
      ORDER BY 2
      LIMIT 1`;
    if (!hits.length) return { village: null, reason: 'no_village_within_15km' as const };

    const row = await this.prisma.location.findUnique({
      where: { id: hits[0].id },
      include: { parent: { include: { parent: true } } },
    });
    return { village: this.toDto(row!, lang), distanceKm: Math.round(hits[0].metres) / 1000 };
  }

  async children(id: string, lang: Lang = 'te') {
    const parent = await this.prisma.location.findUnique({ where: { id }, include: { children: true } });
    if (!parent) throw new NotFoundException('Unknown location');
    return parent.children.map((c) => ({
      id: c.id,
      level: c.level,
      name: this.label(c, lang),
      nameEn: c.name,
    }));
  }

  private label(r: { name: string; nameTe: string | null; nameHi: string | null }, lang: Lang) {
    return (lang === 'te' ? r.nameTe : lang === 'hi' ? r.nameHi : r.name) || r.name;
  }

  private toDto(r: any, lang: Lang) {
    const mandal = r.parent;
    const district = mandal?.parent;
    return {
      id: r.id,
      name: this.label(r, lang),
      nameEn: r.name,
      pincode: r.pincode,
      mandal: mandal ? { id: mandal.id, name: this.label(mandal, lang), nameEn: mandal.name } : null,
      district: district ? { id: district.id, name: this.label(district, lang), nameEn: district.name } : null,
      // "Ghatkesar, Medchal-Malkajgiri" -- what a post shows publicly.
      label: [this.label(r, lang), district ? this.label(district, lang) : null].filter(Boolean).join(', '),
    };
  }
}
