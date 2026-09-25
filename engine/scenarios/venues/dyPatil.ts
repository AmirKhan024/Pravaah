// DY Patil Stadium is the hand-built flagship (engine/scenarios/dyPatil.ts); the venue list points at it unchanged.
import { dyPatil } from '../dyPatil';

export const dyPatilVenue = { id: 'dyPatil' as const, scenario: dyPatil };
