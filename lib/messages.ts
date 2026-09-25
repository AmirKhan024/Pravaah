/*
 * Crowd / staff / transport / accommodation messages (SOURCE_OF_TRUTH §13, §14.4).
 * Fixed templates. EVERY number is injected from the simulation — nothing here is written by a model.
 * Marathi uses Devanagari numerals. Templates to be reviewed by a native speaker on the team.
 */
import { clockFor, comma, type Intervention, type Lang, type Scenario, type SimResult } from '@/engine';

const DEVA = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
export const devaDigits = (s: string) => s.replace(/[0-9]/g, (d) => DEVA[+d]);
export const LANGS: { id: Lang; label: string; native: string }[] = [
  { id: 'mr', label: 'Marathi', native: 'मराठी' },
  { id: 'hi', label: 'Hindi', native: 'हिंदी' },
  { id: 'en', label: 'English', native: 'English' },
];

export interface CrowdMsgVars {
  gate: string; // "Gate 5"
  gateNum: string; // "5"
  walk: number; // extra walking minutes
  saved: number; // minutes saved (from nudgeInfo)
  rupees: number;
  delta?: number;
}

export function crowdMessage(lang: Lang, ask: 'reroute' | 'shift', v: CrowdMsgVars): { head: string; body: string; yes: string; no: string } {
  const r = v.rupees;
  if (ask === 'shift') {
    const m = Math.abs(v.delta || 40);
    if (lang === 'mr')
      return {
        head: devaDigits(`${m} मिनिटं लवकर या.`),
        body: devaDigits(`गेटवर गर्दी होण्याआधी आत पोहोचा.${r ? ` लवकर आल्यास ₹${r} चं कूपन.` : ''}`),
        yes: 'हो, लवकर येतो',
        no: 'नको',
      };
    if (lang === 'hi')
      return { head: `${m} मिनट पहले आइए।`, body: `गेट पर भीड़ से पहले अंदर पहुँचिए।${r ? ` जल्दी आने पर ₹${r} का कूपन।` : ''}`, yes: 'हाँ, जल्दी आऊँगा', no: 'रहने दें' };
    return { head: `Come ${m} minutes earlier.`, body: `Get in before the gates fill up.${r ? ` ₹${r} voucher if you do.` : ''}`, yes: 'Yes, I will', no: 'No thanks' };
  }
  if (lang === 'mr')
    return {
      head: devaDigits(`गेट ${v.gateNum} रिकामं आहे.`),
      body: devaDigits(`${v.walk} मिनिटं जास्त चाला, सुमारे ${v.saved} मिनिटं वाचवा.${r ? ` ₹${r} चं कूपन मिळेल.` : ''}`),
      yes: 'हो, तिकडे जातो',
      no: 'नको',
    };
  if (lang === 'hi')
    return {
      head: `गेट ${v.gateNum} खाली है।`,
      body: `${v.walk} मिनट ज़्यादा चलिए, लगभग ${v.saved} मिनट बचाइए।${r ? ` ₹${r} का कूपन मिलेगा।` : ''}`,
      yes: 'हाँ, चलता हूँ',
      no: 'रहने दें',
    };
  return { head: `${v.gate} is empty.`, body: `Walk ${v.walk} more minutes, skip about ${v.saved} minutes of queue.${r ? ` ₹${r} voucher on arrival.` : ''}`, yes: 'Yes, send me', no: 'No thanks' };
}

export const gateOfPath = (scn: Scenario, pth?: string[]) => {
  if (!pth) return undefined;
  const l = scn.links.find((x) => x.id === pth[pth.length - 2]);
  return l ? l.gate : undefined;
};
export const zoneName = (scn: Scenario, id?: string) => scn.zones.find((z) => z.id === id)?.name || id || '';

export function nudgeVars(scn: Scenario, cohortId: string, res: SimResult, rupees = 0, delta?: number): CrowdMsgVars {
  const c = scn.cohorts.find((x) => x.id === cohortId)!;
  const g = gateOfPath(scn, c.alt) || gateOfPath(scn, c.path) || '';
  const gate = zoneName(scn, g);
  const n = res.nudgeInfo.find((x) => x.cohort === cohortId);
  return { gate, gateNum: gate.replace(/[^0-9]/g, '') || gate, walk: c.altExtraMin || 8, saved: n ? n.saved : 0, rupees, delta };
}

export interface OrderCard {
  kind: 'crowd' | 'staff' | 'transport' | 'accommodation' | 'food';
  title: string;
  sub?: string;
  body?: string;
  langs?: { lang: Lang; text: string }[];
  cohort?: string;
  ask?: 'reroute' | 'shift';
}

/** Plan → orders. Every number is read off the simulated interventions and their result. */
export function buildOrders(scn: Scenario, ivs: Intervention[], r: SimResult): OrderCard[] {
  const clock = (t: number) => clockFor(scn, t);
  const cards: OrderCard[] = [];
  for (const iv of ivs) {
    if (iv.type !== 'nudge') continue;
    const c = scn.cohorts.find((x) => x.id === iv.cohort);
    const n = r.nudgeInfo.find((x) => x.cohort === iv.cohort);
    const v = nudgeVars(scn, iv.cohort, r, iv.rupees, iv.delta);
    cards.push({
      kind: 'crowd',
      cohort: iv.cohort,
      ask: iv.ask,
      title: iv.ask === 'reroute' ? `Tell ${c?.label || iv.cohort} that ${v.gate} is empty` : `Ask ${c?.label || iv.cohort} to come earlier`,
      sub: n ? `About ${comma(n.accepted)} people are expected to follow it (${Math.round(n.p * 100)}%). Each saves about ${n.saved} minutes.` : undefined,
      langs: (['mr', 'hi', 'en'] as Lang[]).map((lang) => {
        const m = crowdMessage(lang, iv.ask, v);
        return { lang, text: m.head + ' ' + m.body };
      }),
    });
  }
  for (const iv of ivs) {
    if (iv.type === 'lanes') {
      const g = zoneName(scn, iv.gate);
      cards.push({ kind: 'staff', title: `Extra bag-check lanes at ${g}`, body: `Send ${iv.n} more bag-check staff to ${g}. They must be screening bags by ${clock(iv.from)}. That lets ${iv.n * scn.laneRate} more people through every minute.` });
    } else if (iv.type === 'shuttle') {
      const l = scn.links.find((x) => x.id === iv.link);
      cards.push({ kind: 'transport', title: `Extra shuttles on ${l?.name || 'the route'}`, body: `Send ${iv.vehicles} extra shuttle buses onto ${l?.name || 'the route'}. They must be running by ${clock(iv.from)}.` });
    } else if (iv.type === 'stagger') {
      const c = scn.cohorts.find((x) => x.id === iv.cohort);
      const m = Math.abs(iv.delta);
      if (c && c.id.indexOf('htl') >= 0)
        cards.push({ kind: 'transport', title: `${c.label.replace(' guests', '')}: coaches leave early`, body: `Tell the ${c.label.replace(' guests', '').toLowerCase()} coaches to leave ${m} minutes earlier than planned, so they do not arrive with everyone else.` });
      else cards.push({ kind: 'transport', title: `Open ${c?.label || 'the car park'} early`, body: `Open entry for ${c?.label || iv.cohort} ${m} minutes earlier than planned.` });
    } else if (iv.type === 'house') {
      const far = scn.zones.filter((z) => z.type === 'hotel' && z.rooms && z.occupied != null && (z.rooms - z.occupied) / z.rooms > 0.35);
      cards.push({
        kind: 'accommodation',
        title: 'Book the empty rooms',
        body: `Block-book ${comma(scn.lateBookings - r.unhoused)} rooms in ${far.map((z) => z.name.replace(' hotels', '')).join(' and ') || 'the far clusters'} for the late bookers with nowhere to stay nearby. Put them on coaches to the quiet gate, not cabs to the busy one.`,
      });
    } else if (iv.type === 'food') {
      cards.push({ kind: 'food', title: `More food stalls at ${zoneName(scn, iv.zone)}`, body: `Open ${iv.n} more food stalls at ${zoneName(scn, iv.zone)} by ${clock(iv.from)}. The rerouted crowd will need them.` });
    }
  }
  return cards;
}

/** PA announcement text (spoken). Numbers injected. */
export function paText(lang: Lang, v: CrowdMsgVars): string {
  const m = crowdMessage(lang, 'reroute', v);
  if (lang === 'en') return `Attention please. ${m.head} ${m.body} Thank you.`;
  if (lang === 'hi') return `कृपया ध्यान दें। ${m.head} ${m.body} धन्यवाद।`;
  return `कृपया लक्ष द्या. ${m.head} ${m.body} धन्यवाद.`;
}
