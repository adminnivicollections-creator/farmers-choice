/**
 * Andhra Pradesh district -> ANGRAU agro-climatic zone, used only to preselect
 * the paddy zone (the farmer can always change it).
 *
 * ponytail: deliberately partial. Districts that straddle two zones after the
 * 2022 reorganisation (Prakasam, Kadapa, the Rayalaseema districts) and the
 * Scarce Rainfall zone (no trusted paddy figure yet) are left out, so those
 * farmers pick the zone themselves rather than get a confident wrong guess.
 */
const ZONE_BY_DISTRICT: Record<string, string> = {
  guntur: 'krishna', krishna: 'krishna', ntr: 'krishna', bapatla: 'krishna', palnadu: 'krishna',
  'east godavari': 'godavari', 'west godavari': 'godavari', kakinada: 'godavari',
  konaseema: 'godavari', 'dr. b.r. ambedkar konaseema': 'godavari', eluru: 'godavari',
  srikakulam: 'northCoastal', vizianagaram: 'northCoastal', visakhapatnam: 'northCoastal', anakapalli: 'northCoastal',
  'alluri sitharama raju': 'hat', 'parvathipuram manyam': 'hat',
  nellore: 'southern', 'sri potti sriramulu nellore': 'southern',
};

export function zoneForDistrict(name?: string | null): string | null {
  if (!name) return null;
  const key = name.toLowerCase().replace(/\s+district$/, '').trim();
  return ZONE_BY_DISTRICT[key] ?? null;
}
