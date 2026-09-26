'use client';
/*
 * /setup — "an event head gives Pravaah THEIR data" (build brief, step 2/3). Three ways in, in
 * order of effort: Quick Start (5-6 numbers, an immediate estimated answer), the bundled sample
 * fixture, or the event head's own CSVs. Nothing here ever leaves the browser — buildVenueScenario
 * and loadScenarioFromRows both run client-side, and the only network call is the optional live
 * venue search (blocked entirely under DEMO_OFFLINE).
 */
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  buildVenueScenario,
  parseCsv,
  loadScenarioFromRows,
  validateCsvInput,
  VENUES,
  type ArrivalRow,
  type CsvScenarioInput,
  type EventRow,
  type GateRow,
  type HotelRow,
  type ResourceRow,
  type TicketRow,
  type VenueSpec,
} from '@/engine';
import { loadScenario, type ScenarioBundle } from '@/lib/console';
import { Button, Card, Kicker, Logo, cx } from '@/components/ui';

const CACHED = VENUES.filter((v) => v.spec); // the flagship (spec: null) isn't a Quick Start starting point

function toMin(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  return +m[1] * 60 + +m[2];
}

const TEMPLATES: Record<string, string> = {
  'event.csv': 'name,date,gates_open,match_start,capacity,expected_turnout_pct,venue_lat,venue_lng,status,source_note\nYour match name,2026-01-01,16:00,19:30,30000,90,19.0000,73.0000,estimated,replace with your own data\n',
  'gates.csv':
    'gate_id,name,side,lanes,forecourt_area_m2,stands_served,vip_gate,accessible_lane,status,source_note\nG1,Gate 1,north,8,2000,North Stand,false,true,estimated,replace with your own data\n',
  'tickets.csv':
    'snapshot_label,snapshot_date,stand,gate_id,category,tickets_sold,days_before_match,alt_gates,status,source_note\nT-1,2025-12-31,North Stand,G1,General,9000,1,,estimated,replace with your own data\n',
  'arrivals.csv':
    'group,size,share_pct,mode,origin,preferred_gate,ticket_gate,mean_arrival_time,spread_min,pulse_period_min,status,source_note\nMain rail arrivals,9000,30,rail,Your station,G1,G1,18:30,30,6,estimated,replace with your own data\n',
  'hotels.csv':
    'cluster,name,rooms_total,rooms_booked,distance_km,price_inr,coach_available,status,source_note\nYour cluster,Example hotel,100,90,5,5000,false,estimated,replace with your own data\n',
  'resources.csv': 'resource,quantity,cost_inr,unit,notes,status,source_note\nGate staff,50,800,person-shift,~1 per 250 spectators,estimated,replace with your own data\n',
};

function downloadTemplate(name: string) {
  const blob = new Blob([TEMPLATES[name]], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

const ROLE_MATCH: Record<keyof CsvScenarioInput, RegExp> = {
  event: /event/i,
  gates: /gate/i,
  tickets: /ticket/i,
  arrivals: /arriv/i,
  hotels: /hotel/i,
  resources: /resource/i,
};

async function filesToInput(files: FileList): Promise<{ input?: CsvScenarioInput; errors: string[] }> {
  const byRole: Partial<Record<keyof CsvScenarioInput, File>> = {};
  for (const f of Array.from(files)) {
    const role = (Object.keys(ROLE_MATCH) as (keyof CsvScenarioInput)[]).find((r) => ROLE_MATCH[r].test(f.name));
    if (role && !byRole[role]) byRole[role] = f;
  }
  const missing = (Object.keys(ROLE_MATCH) as (keyof CsvScenarioInput)[]).filter((r) => !byRole[r]);
  if (missing.length) return { errors: missing.map((r) => `No file matched "${r}" — expected a file named like ${r}.csv.`) };
  const text = await Promise.all((Object.keys(ROLE_MATCH) as (keyof CsvScenarioInput)[]).map((r) => byRole[r]!.text()));
  const [event, gates, tickets, arrivals, hotels, resources] = text.map((t) => parseCsv(t));
  return {
    input: {
      event: event as unknown as EventRow[],
      gates: gates as unknown as GateRow[],
      tickets: tickets as unknown as TicketRow[],
      arrivals: arrivals as unknown as ArrivalRow[],
      hotels: hotels as unknown as HotelRow[],
      resources: resources as unknown as ResourceRow[],
    },
    errors: [],
  };
}

export default function Setup() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);

  const [venueChoice, setVenueChoice] = useState<string>(CACHED[0]?.id ?? '');
  const [otherName, setOtherName] = useState('');
  const [capacity, setCapacity] = useState('30000');
  const [date, setDate] = useState('2026-01-01');
  const [gatesOpen, setGatesOpen] = useState('16:00');
  const [kickoff, setKickoff] = useState('19:30');
  const [turnout, setTurnout] = useState('90');
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const go = (bundle: ScenarioBundle) => {
    loadScenario(bundle);
    router.push('/live');
  };

  async function submitQuickStart() {
    setErrors([]);
    const cap = Math.max(500, Math.round(Number(capacity) || 0));
    const gOpen = toMin(gatesOpen);
    const kOff = toMin(kickoff);
    const turn = Math.max(1, Math.min(100, Number(turnout) || 90));
    if (!cap) return setErrors(['Capacity must be a number.']);
    if (gOpen == null) return setErrors(['Gates-open time must be HH:MM.']);
    if (kOff == null) return setErrors(['Kickoff time must be HH:MM.']);
    if (gOpen >= kOff) return setErrors(['Gates must open before kickoff.']);

    setBusy('Building your first answer…');
    try {
      let spec: VenueSpec;
      const cached = CACHED.find((v) => v.id === venueChoice);
      if (cached?.spec) {
        spec = { ...cached.spec, capacity: cap, gatesOpenMin: gOpen, showMin: kOff, t0Min: gOpen - 120 };
      } else {
        if (!otherName.trim()) {
          setBusy(null);
          return setErrors(['Type a venue name, or pick a cached one (works offline).']);
        }
        const r = await fetch('/api/venues/import', { method: 'POST', body: JSON.stringify({ q: otherName, capacity: cap, showMin: kOff }) });
        const j = await r.json();
        if (!j.ok) {
          setBusy(null);
          return setErrors([j.reason || 'Could not find that venue. Try a cached one below (works offline).']);
        }
        spec = { ...j.spec, capacity: cap, gatesOpenMin: gOpen, showMin: kOff, t0Min: gOpen - 120 };
      }
      const scenario = buildVenueScenario(spec);
      scenario.sub = `${scenario.sub} · expected turnout ${turn}% (estimated) · match day ${date}`;
      go({
        scenario,
        source: 'custom',
        fields: [
          { file: 'quick start', row: 'venue', tag: cached ? 'real' : 'estimated', sourceNote: cached ? 'cached venue graph' : 'OpenStreetMap-derived graph' },
          { file: 'quick start', row: 'capacity', tag: 'real' },
          { file: 'quick start', row: 'match date', tag: 'real' },
          { file: 'quick start', row: 'gates open', tag: 'real' },
          { file: 'quick start', row: 'kickoff', tag: 'real' },
          { file: 'quick start', row: 'expected turnout %', tag: 'real' },
          ...spec.gates.map((g) => ({ file: 'venue graph', row: 'Gate ' + (g.name || g.id), tag: 'estimated' as const, sourceNote: 'default lanes/forecourt — edit in the Data drawer' })),
        ],
        confidence: { real: 6, estimated: spec.gates.length, invented: 0, playbook: 0, total: 6 + spec.gates.length, level: 'low' },
      });
    } finally {
      setBusy(null);
    }
  }

  async function useSample() {
    setErrors([]);
    setBusy('Loading the sample event…');
    try {
      const r = await fetch('/api/sample/dy-patil');
      const raw = (await r.json()) as Record<string, string>;
      const input: CsvScenarioInput = {
        event: parseCsv(raw.event) as unknown as EventRow[],
        gates: parseCsv(raw.gates) as unknown as GateRow[],
        tickets: parseCsv(raw.tickets) as unknown as TicketRow[],
        arrivals: parseCsv(raw.arrivals) as unknown as ArrivalRow[],
        hotels: parseCsv(raw.hotels) as unknown as HotelRow[],
        resources: parseCsv(raw.resources) as unknown as ResourceRow[],
      };
      const res = loadScenarioFromRows(input, { venueLabel: 'DY Patil Stadium (sample fixture)' });
      if (!res.ok) return setErrors(res.errors);
      go({ scenario: res.data.scenario, source: 'sample', fields: res.data.fields, confidence: res.data.confidence, resources: res.data.resources });
    } catch {
      setErrors(['Could not load the sample data.']);
    } finally {
      setBusy(null);
    }
  }

  async function handleUpload(files: FileList | null) {
    if (!files || !files.length) return;
    setErrors([]);
    setBusy('Reading your files…');
    try {
      const { input, errors: matchErrors } = await filesToInput(files);
      if (matchErrors.length || !input) return setErrors(matchErrors);
      const csvErrors = validateCsvInput(input);
      if (csvErrors.length) return setErrors(csvErrors);
      const res = loadScenarioFromRows(input);
      if (!res.ok) return setErrors(res.errors);
      go({ scenario: res.data.scenario, source: 'custom', fields: res.data.fields, confidence: res.data.confidence, resources: res.data.resources });
    } catch {
      setErrors(['Could not read those files — make sure they are plain CSV.']);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="min-h-dvh bg-ink px-5 py-10 text-text">
      <div className="mx-auto flex max-w-[720px] flex-col gap-8">
        <div className="flex items-center gap-2.5 text-brass">
          <Logo className="size-6" />
          <span className="text-[13px] font-semibold tracking-[0.2em] text-text">PRAVAAH</span>
          <span className="ml-auto text-[12px] text-dimmer">
            <Link href="/live" className="hover:text-text">
              Skip to Live Ops (flagship demo) →
            </Link>
          </span>
        </div>

        <div>
          <h1 className="font-display text-[28px] leading-tight">Give Pravaah your event</h1>
          <p className="mt-1 text-[13.5px] text-dim">Every risk, action and message from here on comes from what you enter below — not a demo script.</p>
        </div>

        {errors.length ? (
          <Card tone="danger">
            <Kicker>Couldn&apos;t load that</Kicker>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-[13px] text-danger-soft">
              {errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </Card>
        ) : null}

        <Card>
          <Kicker right={<span>Step 1</span>}>Quick start — 6 numbers, an immediate first answer</Kicker>
          <div className="grid grid-cols-2 gap-3 text-[13px]">
            <label className="col-span-2 flex flex-col gap-1">
              Venue
              <select value={venueChoice} onChange={(e) => setVenueChoice(e.target.value)} className="rounded-lg border border-line bg-panel-2 px-3 py-2 text-text">
                {CACHED.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.city}) — cached, works offline
                  </option>
                ))}
                <option value="other">Other — type a name (needs internet)</option>
              </select>
            </label>
            {venueChoice === 'other' ? (
              <input
                className="col-span-2 rounded-lg border border-line bg-panel-2 px-3 py-2 text-text"
                placeholder="e.g. Eden Gardens, Kolkata"
                value={otherName}
                onChange={(e) => setOtherName(e.target.value)}
              />
            ) : null}
            <label className="flex flex-col gap-1">
              Capacity (expected turnout)
              <input className="rounded-lg border border-line bg-panel-2 px-3 py-2 text-text" value={capacity} onChange={(e) => setCapacity(e.target.value)} inputMode="numeric" />
            </label>
            <label className="flex flex-col gap-1">
              Expected turnout %
              <input className="rounded-lg border border-line bg-panel-2 px-3 py-2 text-text" value={turnout} onChange={(e) => setTurnout(e.target.value)} inputMode="numeric" />
            </label>
            <label className="flex flex-col gap-1">
              Match date
              <input type="date" className="rounded-lg border border-line bg-panel-2 px-3 py-2 text-text" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              Gates open
              <input className="rounded-lg border border-line bg-panel-2 px-3 py-2 text-text" value={gatesOpen} onChange={(e) => setGatesOpen(e.target.value)} placeholder="HH:MM" />
            </label>
            <label className="flex flex-col gap-1">
              Kickoff
              <input className="rounded-lg border border-line bg-panel-2 px-3 py-2 text-text" value={kickoff} onChange={(e) => setKickoff(e.target.value)} placeholder="HH:MM" />
            </label>
          </div>
          <Button variant="solid" size="lg" className="mt-4 w-full" disabled={!!busy} onClick={submitQuickStart}>
            {busy ?? 'Get my first answer →'}
          </Button>
          <p className="mt-2 text-[11.5px] text-dimmer">Everything not listed above (lanes, forecourt sizes, stations, hotels) starts as a labelled estimate. Add real detail below any time.</p>
        </Card>

        <Card>
          <Kicker right={<span>Step 2a</span>}>Use the sample event</Kicker>
          <p className="text-[13px] text-dim">An illustrative fixture at DY Patil Stadium — real coordinates, invented ticket/arrival numbers, every row labelled. Good for seeing what a fuller dataset unlocks.</p>
          <Button className="mt-3" disabled={!!busy} onClick={useSample}>
            {busy ?? 'Load the sample data →'}
          </Button>
        </Card>

        <Card>
          <Kicker right={<span>Step 2b</span>}>Bring your own data</Kicker>
          <p className="text-[13px] text-dim">Six CSVs: event, gates, tickets, arrivals, hotels, resources. Nothing leaves your browser.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.keys(TEMPLATES).map((name) => (
              <button key={name} onClick={() => downloadTemplate(name)} className="rounded-lg border border-line px-2.5 py-1 text-[11.5px] text-dim hover:border-brass-dim/60 hover:text-text">
                ↓ {name}
              </button>
            ))}
          </div>
          <input ref={fileInput} type="file" accept=".csv" multiple className="hidden" onChange={(e) => handleUpload(e.target.files)} />
          <Button className="mt-3" disabled={!!busy} onClick={() => fileInput.current?.click()}>
            {busy ?? 'Choose 6 CSV files →'}
          </Button>
        </Card>

        <p className={cx('text-center text-[11.5px] text-dimmer')}>PS-8 · uploaded data stays in your browser and is never sent to a server.</p>
      </div>
    </div>
  );
}
