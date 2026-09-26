'use client';
import { Pill } from '@/components/ui';
import type { OwnerTrust } from '@/lib/owner/types';

const NEXT: Record<OwnerTrust, OwnerTrust> = { claimed: 'document-checked', 'document-checked': 'verified', verified: 'claimed' };
const TONE: Record<OwnerTrust, 'default' | 'brass' | 'safe'> = { claimed: 'default', 'document-checked': 'brass', verified: 'safe' };

/** A small, tappable trust pill — reuses v2's claimed/document-checked/verified ladder and this
 *  app's own brass/safe colour tones (SOURCE_OF_TRUTH §13: brass is the only accent). Click to
 *  cycle; there's no backend to "verify" against yet, so this is the owner's own honest say-so. */
export function TrustPill({ trust, onChange }: { trust: OwnerTrust; onChange?: (t: OwnerTrust) => void }) {
  return (
    <button type="button" onClick={() => onChange?.(NEXT[trust])} title="Click to change" className="shrink-0">
      <Pill tone={TONE[trust]}>{trust}</Pill>
    </button>
  );
}
