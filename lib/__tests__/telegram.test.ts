/*
 * Phase 3 §3: "never fail silently." Confirms sendTelegramMessage() returns a clear, actionable
 * reason (not a thrown error, not a silent no-op) when Telegram isn't configured.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('telegram — never fails silently', () => {
  const prevToken = process.env.TELEGRAM_BOT_TOKEN;
  const prevChat = process.env.TELEGRAM_OPS_CHAT_ID;
  beforeEach(() => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_OPS_CHAT_ID;
  });
  afterEach(() => {
    if (prevToken) process.env.TELEGRAM_BOT_TOKEN = prevToken;
    if (prevChat) process.env.TELEGRAM_OPS_CHAT_ID = prevChat;
  });

  it('telegramConfigured() is false when either var is missing', async () => {
    const { telegramConfigured } = await import('../telegram');
    expect(telegramConfigured()).toBe(false);
    process.env.TELEGRAM_BOT_TOKEN = 'x';
    expect(telegramConfigured()).toBe(false); // chat id still missing
  });

  it('sendTelegramMessage() returns a clear reason, never throws, when unconfigured', async () => {
    const { sendTelegramMessage } = await import('../telegram');
    const r = await sendTelegramMessage('test');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/not configured/i);
  });
});
