/*
 * A typed what-if → a structured scenario patch. The shape is fixed and every field is clamped.
 * The engine then runs the evening; the numbers shown come from simulate(), never from the parser.
 */
export interface WhatIfSpec {
  rain: boolean;
  /** minutes after midnight, or null */
  railFailAt: number | null;
  showDelayMin: number;
  gatesLateMin: number;
  /** −30..+30 */
  turnoutPct: number;
  slowLanes: boolean;
}

export const EMPTY_SPEC: WhatIfSpec = { rain: false, railFailAt: null, showDelayMin: 0, gatesLateMin: 0, turnoutPct: 0, slowLanes: false };

const clamp = (v: unknown, lo: number, hi: number) => {
  const n = Number(v);
  return isNaN(n) ? 0 : Math.max(lo, Math.min(hi, Math.round(n)));
};

export function hhmmToMin(s: unknown): number | null {
  if (typeof s !== 'string') return null;
  const m = s.match(/(\d{1,2})[:.](\d{2})/);
  if (!m) return null;
  const h = +m[1],
    mi = +m[2];
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

export function sanitizeSpec(raw: unknown): WhatIfSpec | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const spec: WhatIfSpec = {
    rain: !!o.rain,
    railFailAt: o.railFailAt == null ? null : hhmmToMin(o.railFailAt),
    showDelayMin: clamp(o.showDelayMin, 0, 90),
    gatesLateMin: clamp(o.gatesLateMin, 0, 180),
    turnoutPct: clamp(o.turnoutPct, -30, 30),
    slowLanes: !!o.slowLanes,
  };
  const any = spec.rain || spec.railFailAt != null || spec.showDelayMin || spec.gatesLateMin || spec.turnoutPct || spec.slowLanes;
  return any ? spec : null;
}

/** offline fallback: plain word matching (English, Hindi, Marathi keywords) */
export function localParse(q: string): WhatIfSpec | null {
  const s = q.toLowerCase();
  const spec: WhatIfSpec = { ...EMPTY_SPEC };
  const time = s.match(/(\d{1,2})[:.](\d{2})/) || s.match(/\b(\d{1,2})\s*(pm|am)\b/);
  let at: number | null = null;
  if (time) {
    let h = +time[1];
    const m = time[2] && /\d/.test(time[2]) ? +time[2] : 0;
    if (time[2] === 'pm' && h < 12) h += 12;
    at = h * 60 + m;
  }
  if (/rain|storm|wet|monsoon|पाऊस|बारिश|बरसात/.test(s)) spec.rain = true;
  if (/train|rail|metro|harbour|local|line|ट्रेन|लोकल/.test(s) && /fail|stop|down|cancel|late|delay|बंद|रद्द/.test(s)) spec.railFailAt = at ?? 18 * 60 + 30;
  const mins = s.match(/(\d{1,3})\s*(min|minute|मिनिट|मिनट)/);
  if (/show|concert|match|start/.test(s) && /late|delay|push|postpone/.test(s)) spec.showDelayMin = mins ? +mins[1] : 30;
  else if (/gate|screen|entry|door/.test(s) && /late|delay|open/.test(s)) spec.gatesLateMin = mins ? +mins[1] : 30;
  const pct = s.match(/(\d{1,2})\s*(%|percent)/);
  if (/more people|bigger crowd|extra|more fans|surge|ज्यादा|जास्त/.test(s)) spec.turnoutPct = pct ? +pct[1] : 12;
  if (/fewer|less people|smaller crowd|कम/.test(s)) spec.turnoutPct = -(pct ? +pct[1] : 10);
  if (/slow|scanner|staff short|strike/.test(s) && /check|screen|bag|lane|scan|staff|strike/.test(s)) spec.slowLanes = true;
  return sanitizeSpec({ ...spec, railFailAt: spec.railFailAt != null ? `${Math.floor(spec.railFailAt / 60)}:${String(spec.railFailAt % 60).padStart(2, '0')}` : null });
}

const hm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
/** the label and explanation are built by us from the validated spec — not written by the model */
export function describeSpec(spec: WhatIfSpec): { label: string; say: string } {
  const parts: string[] = [],
    says: string[] = [];
  if (spec.turnoutPct > 0) {
    parts.push(`${spec.turnoutPct}% more people`);
    says.push(`${spec.turnoutPct}% more people turn up than planned.`);
  }
  if (spec.turnoutPct < 0) {
    parts.push(`${-spec.turnoutPct}% fewer people`);
    says.push(`${-spec.turnoutPct}% fewer people turn up.`);
  }
  if (spec.rain) {
    parts.push('heavy rain');
    says.push('Bag checks slow under cover, walking slows on wet ground, and more people take cabs.');
  }
  if (spec.railFailAt != null) {
    parts.push(`rail fails at ${hm(spec.railFailAt)}`);
    says.push(`The line stops at ${hm(spec.railFailAt)}. Everyone still travelling arrives late and bunched, and the station approaches choke.`);
  }
  if (spec.gatesLateMin) {
    parts.push(`gates ${spec.gatesLateMin} min late`);
    says.push(`Screening opens ${spec.gatesLateMin} minutes late.`);
  }
  if (spec.showDelayMin) {
    parts.push(`show ${spec.showDelayMin} min later`);
    says.push(`The show starts ${spec.showDelayMin} minutes later; arrivals drift later too.`);
  }
  if (spec.slowLanes) {
    parts.push('slower bag checks');
    says.push('Each bag-check lane handles 10% fewer people a minute.');
  }
  const label = parts.join(' + ');
  return { label: label.charAt(0).toUpperCase() + label.slice(1), say: says.join(' ') };
}
