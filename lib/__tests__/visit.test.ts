import { describe, expect, it } from 'vitest';
import { buildVisitCard, hotelOptions, STAY_TIP } from '../visit';
import type { RoomSnapshot, VisitOrigin } from '../roomTypes';

const railOrigin: VisitOrigin = {
  id: 'nerul_rail',
  label: 'Nerul rail',
  originLabel: 'Nerul station',
  transportMode: 'Local train',
  meanTick: 300,
  mainGateId: 'g3',
  mainGateName: 'Gate 3',
  altGateId: 'g2',
  altGateName: 'Gate 2',
  isHotel: false,
  tip: 'Food stall gets busy — expect about 8 min in line.',
};
const hotelOrigin: VisitOrigin = {
  id: 'vashi_htl',
  label: 'Vashi guests',
  originLabel: 'Vashi hotels',
  transportMode: 'Hotel coach',
  meanTick: 250,
  mainGateId: 'g1',
  mainGateName: 'Gate 1',
  altGateId: null,
  altGateName: null,
  isHotel: true,
  tip: STAY_TIP,
};

function snap(plan: RoomSnapshot['plan'], baseGateWaitPeak: Record<string, number> = {}): Pick<RoomSnapshot, 't0Min' | 'origins' | 'baseGateWaitPeak' | 'plan'> {
  return { t0Min: 840, origins: [railOrigin, hotelOrigin], baseGateWaitPeak, plan };
}

describe('buildVisitCard', () => {
  it('uses the main gate and the plain arrival-minus-wait leave-by time when no plan has redirected this cohort', () => {
    const card = buildVisitCard(snap(null), { lang: 'en', originId: 'nerul_rail', mode: 'Local train', stayingHotelId: null, partySize: 2 });
    expect(card).not.toBeNull();
    expect(card!.gateName).toBe('Gate 3');
    expect(card!.redirected).toBe(false);
    expect(card!.route).toContain('Nerul station');
    expect(card!.tip).toBe(railOrigin.tip);
  });

  it('switches to the alt gate the instant the room plan marks this cohort redirected — the "Do it" moment', () => {
    const card = buildVisitCard(snap({ approvedAt: Date.now(), redirects: { nerul_rail: true }, gateWaitPeak: { g2: 5 } }), {
      lang: 'en',
      originId: 'nerul_rail',
      mode: 'Local train',
      stayingHotelId: null,
      partySize: 1,
    });
    expect(card!.gateName).toBe('Gate 2');
    expect(card!.redirected).toBe(true);
  });

  it('never redirects a cohort with no alt gate, even if the plan somehow names it', () => {
    const card = buildVisitCard(snap({ approvedAt: Date.now(), redirects: { vashi_htl: true }, gateWaitPeak: {} }), {
      lang: 'en',
      originId: 'vashi_htl',
      mode: 'Hotel coach',
      stayingHotelId: 'vashi_htl',
      partySize: 3,
    });
    expect(card!.gateName).toBe('Gate 1');
    expect(card!.redirected).toBe(false);
  });

  it('shows the stay tip once the visitor says they are staying at a hotel, regardless of where they travel from', () => {
    const card = buildVisitCard(snap(null), { lang: 'en', originId: 'nerul_rail', mode: 'Local train', stayingHotelId: 'vashi_htl', partySize: 2 });
    expect(card!.tip).toBe(STAY_TIP);
  });

  it('a longer gate wait pushes the leave-by time earlier', () => {
    const quiet = buildVisitCard(snap({ approvedAt: 0, redirects: {}, gateWaitPeak: { g3: 0 } }), { lang: 'en', originId: 'nerul_rail', mode: 'Local train', stayingHotelId: null, partySize: 1 })!;
    const busy = buildVisitCard(snap({ approvedAt: 0, redirects: {}, gateWaitPeak: { g3: 30 } }), { lang: 'en', originId: 'nerul_rail', mode: 'Local train', stayingHotelId: null, partySize: 1 })!;
    const toMin = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
    expect(toMin(busy.leaveBy)).toBeLessThan(toMin(quiet.leaveBy));
  });

  it('returns null for an origin id the room does not know about', () => {
    expect(buildVisitCard(snap(null), { lang: 'en', originId: 'nope', mode: 'walk', stayingHotelId: null, partySize: 1 })).toBeNull();
  });

  it('before any plan exists, falls back to the real do-nothing gate wait — never a silent zero', () => {
    // a real bug this feature's own live verification caught: the pre-approval leave-by time was
    // computed as if the gate had no queue at all, when the do-nothing run says otherwise
    const busyBaseline = buildVisitCard(snap(null, { g3: 40 }), { lang: 'en', originId: 'nerul_rail', mode: 'Local train', stayingHotelId: null, partySize: 1 })!;
    const noBaseline = buildVisitCard(snap(null, {}), { lang: 'en', originId: 'nerul_rail', mode: 'Local train', stayingHotelId: null, partySize: 1 })!;
    const toMin = (hhmm: string) => {
      const [h, m] = hhmm.split(':').map(Number);
      return h * 60 + m;
    };
    expect(toMin(busyBaseline.leaveBy)).toBeLessThan(toMin(noBaseline.leaveBy));
  });
});

describe('hotelOptions', () => {
  it('filters to hotel-based origins only', () => {
    expect(hotelOptions([railOrigin, hotelOrigin])).toEqual([hotelOrigin]);
  });
});
