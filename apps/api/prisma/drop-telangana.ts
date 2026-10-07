/** Telangana was the earlier pilot assumption. AP is the market, so the old
 *  tree goes -- leaving it would let a farmer pick a village 300 km away. */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const tg = await prisma.location.findUnique({ where: { lgdCode: '36' } });
  if (!tg) { console.log('no Telangana tree present'); return; }

  // Children first: the self-relation has no cascade.
  const ids: string[] = [];
  const walk = async (parentId: string) => {
    const kids = await prisma.location.findMany({ where: { parentId }, select: { id: true } });
    for (const k of kids) { await walk(k.id); ids.push(k.id); }
  };
  await walk(tg.id);

  await prisma.user.updateMany({ where: { villageId: { in: ids } }, data: { villageId: null } });
  await prisma.location.deleteMany({ where: { id: { in: ids } } });
  await prisma.location.delete({ where: { id: tg.id } });

  const villages = await prisma.location.count({ where: { level: 'VILLAGE' } });
  const states = await prisma.location.findMany({ where: { level: 'STATE' }, select: { name: true } });
  console.log(`removed ${ids.length + 1} Telangana rows`);
  console.log(`states now: ${states.map((s) => s.name).join(', ')} · villages: ${villages}`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
