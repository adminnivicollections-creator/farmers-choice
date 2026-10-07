import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async me(userId: string) {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: true,
        village: { include: { parent: { include: { parent: true } } } },
        farms: { include: { crops: { include: { crop: true } } } },
      },
    });
    if (!u) throw new NotFoundException('User not found');

    return {
      id: u.id,
      phone: u.phone, // only ever on /me, never on a public profile
      name: u.name,
      photoUrl: u.photoUrl,
      preferredLang: u.preferredLang,
      roles: u.roles.map((r) => r.role),
      profileComplete: Boolean(u.name && u.villageId),
      village: u.village && {
        id: u.village.id,
        name: u.village.name,
        mandal: u.village.parent?.name ?? null,
        district: u.village.parent?.parent?.name ?? null,
      },
      farms: u.farms.map((f) => ({
        id: f.id,
        label: f.label,
        area: `${f.areaValue} ${f.areaUnit.toLowerCase()}`,
        soilType: f.soilType,
        irrigationType: f.irrigationType,
        crops: f.crops.map((c) => ({ slug: c.crop.slug, nameEn: c.crop.nameEn, nameTe: c.crop.nameTe })),
      })),
    };
  }

  async updateMe(
    userId: string,
    patch: { name?: string; photoUrl?: string; preferredLang?: 'te' | 'hi' | 'en'; villageId?: string },
  ) {
    // A UUID is not enough: the id must point at a VILLAGE. Without this a
    // client can set its "village" to a district or the whole state, and every
    // feed and proximity query downstream silently widens.
    if (patch.villageId) {
      const loc = await this.prisma.location.findUnique({
        where: { id: patch.villageId },
        select: { level: true },
      });
      if (!loc) throw new BadRequestException('Unknown village');
      if (loc.level !== 'VILLAGE') {
        throw new BadRequestException(`Expected a village, got a ${loc.level.toLowerCase()}`);
      }
    }
    await this.prisma.user.update({ where: { id: userId }, data: patch });
    return this.me(userId);
  }

  /** Public profile. No phone, no village-level precision beyond the label. */
  async publicProfile(id: string) {
    const u = await this.prisma.user.findUnique({
      where: { id },
      include: { roles: true, village: { include: { parent: { include: { parent: true } } } } },
    });
    if (!u || u.blockedAt) throw new NotFoundException('User not found');
    return {
      id: u.id,
      name: u.name,
      photoUrl: u.photoUrl,
      roles: u.roles.map((r) => r.role),
      locality: u.village
        ? [u.village.name, u.village.parent?.parent?.name].filter(Boolean).join(', ')
        : null,
    };
  }
}
