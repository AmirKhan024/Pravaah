import { describe, expect, it } from 'vitest';
import { blendWeight, classifyServerResponse, deriveChoice, MIN_RESPONSES_FOR_OVERRIDE, parseGroupResponse, parseResponse, STRONG_SAMPLE_THRESHOLD } from '../roomResponses';

describe('deriveChoice — backward compatibility with the old yes/no field', () => {
  it('accept and already_moved derive to yes', () => {
    expect(deriveChoice('accept')).toBe('yes');
    expect(deriveChoice('already_moved')).toBe('yes');
  });
  it('decline, ignore and too_late derive to no', () => {
    expect(deriveChoice('decline')).toBe('no');
    expect(deriveChoice('ignore')).toBe('no');
    expect(deriveChoice('too_late')).toBe('no');
  });
});

describe('blendWeight — the small-sample protection (§18)', () => {
  it('is zero for anything under MIN_RESPONSES_FOR_OVERRIDE', () => {
    expect(blendWeight(0)).toBe(0);
    expect(blendWeight(MIN_RESPONSES_FOR_OVERRIDE - 1)).toBe(0);
  });
  it('is one at and above STRONG_SAMPLE_THRESHOLD', () => {
    expect(blendWeight(STRONG_SAMPLE_THRESHOLD)).toBe(1);
    expect(blendWeight(STRONG_SAMPLE_THRESHOLD + 30)).toBe(1);
  });
  it('ramps linearly in between', () => {
    const mid = (MIN_RESPONSES_FOR_OVERRIDE + STRONG_SAMPLE_THRESHOLD) / 2;
    expect(blendWeight(mid)).toBeCloseTo(0.5, 5);
  });
});

describe('classifyServerResponse — never trust the client for timing (§29)', () => {
  it('a submitted accept/decline before the deadline is kept as-is', () => {
    expect(classifyServerResponse('accept', 100, 200)).toBe('accept');
    expect(classifyServerResponse('decline', 100, 200)).toBe('decline');
  });
  it('a submitted accept/decline after the deadline becomes too_late', () => {
    expect(classifyServerResponse('accept', 300, 200)).toBe('too_late');
    expect(classifyServerResponse('decline', 300, 200)).toBe('too_late');
  });
  it('already_moved is a claim about the past, not reclassified regardless of timing', () => {
    expect(classifyServerResponse('already_moved', 300, 200)).toBe('already_moved');
    expect(classifyServerResponse('already_moved', 100, 200)).toBe('already_moved');
  });
});

describe('parseResponse / parseGroupResponse — server-side validation of client enums (§29)', () => {
  it('accepts only the known values', () => {
    expect(parseResponse('accept')).toBe('accept');
    expect(parseResponse('bogus')).toBeNull();
    expect(parseResponse(123)).toBeNull();
  });
  it('group response likewise', () => {
    expect(parseGroupResponse('all')).toBe('all');
    expect(parseGroupResponse('everyone')).toBeNull();
  });
});
