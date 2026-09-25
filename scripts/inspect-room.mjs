// Queries Supabase directly for a room code, to prove data really landed there (not in-memory).
import { createClient } from '@supabase/supabase-js';

const code = process.argv[2];
if (!code) {
  console.error('usage: node scripts/inspect-room.mjs <ROOM-CODE>');
  process.exit(1);
}
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
const { data: room, error: rErr } = await sb.from('rooms').select('*').eq('id', code).maybeSingle();
if (rErr) throw rErr;
console.log('ROOM ROW:', room ? { id: room.id, scenario_id: room.scenario_id, status: room.status, cohorts: room.cohorts.length + ' cohorts', hasBroadcast: !!room.broadcast, hasOutcome: !!room.outcome, created_at: room.created_at } : 'NOT FOUND');
const { data: parts } = await sb.from('participants').select('*').eq('room_id', code);
console.log('PARTICIPANTS:', parts?.length, 'rows. sample:', parts?.slice(0, 2));
const { data: votes } = await sb.from('votes').select('*').eq('room_id', code);
console.log('VOTES:', votes?.length, 'rows. sample:', votes?.slice(0, 2));
if (room?.broadcast) console.log('BROADCAST messages for cohorts:', Object.keys(room.broadcast.messages));
if (room?.outcome) console.log('OUTCOME headline (en):', room.outcome.headline.en);
