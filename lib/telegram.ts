import 'server-only';
/*
 * Telegram ops channel (SOURCE_OF_TRUTH §8.7, updated to Telegram instead of Twilio/WhatsApp for
 * this pass). Staff/transport/accommodation orders only — never crowd messages (those stay on the
 * MR/HI/EN card with Copy/PA, per the brief §Phase 3.5). The bot token never reaches the client;
 * every call here runs server-side, from app/api/telegram/*.
 */

export function telegramConfigured(): boolean {
  return !!process.env.TELEGRAM_BOT_TOKEN && !!process.env.TELEGRAM_OPS_CHAT_ID;
}

export interface TelegramSendResult {
  ok: boolean;
  reason?: string;
  messageId?: number;
}

interface InlineButton {
  text: string;
  callback_data: string;
}

/** Posts one message to the configured ops chat. Optional inline keyboard for the Acknowledge stretch goal. */
export async function sendTelegramMessage(text: string, buttons?: InlineButton[][]): Promise<TelegramSendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_OPS_CHAT_ID;
  if (!token || !chatId) return { ok: false, reason: 'Telegram is not configured on this machine (TELEGRAM_BOT_TOKEN / TELEGRAM_OPS_CHAT_ID).' };
  const ctl = new AbortController();
  const timeout = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      signal: ctl.signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text.slice(0, 4096),
        ...(buttons ? { reply_markup: { inline_keyboard: buttons } } : {}),
      }),
    });
    const j = (await r.json().catch(() => null)) as { ok?: boolean; description?: string; result?: { message_id: number } } | null;
    if (!r.ok || !j?.ok) return { ok: false, reason: j?.description || `Telegram returned ${r.status}` };
    return { ok: true, messageId: j.result?.message_id };
  } catch (e) {
    return { ok: false, reason: e instanceof Error && e.name === 'AbortError' ? 'Telegram did not answer in time.' : 'Could not reach Telegram.' };
  } finally {
    clearTimeout(timeout);
  }
}

/** Edits a previously sent message's inline keyboard — used to show "Acknowledged" after a tap. */
export async function editTelegramReplyMarkup(messageId: number, buttons: InlineButton[][] | null): Promise<TelegramSendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_OPS_CHAT_ID;
  if (!token || !chatId) return { ok: false, reason: 'Telegram is not configured.' };
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/editMessageReplyMarkup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId, reply_markup: buttons ? { inline_keyboard: buttons } : undefined }),
    });
    const j = (await r.json().catch(() => null)) as { ok?: boolean; description?: string } | null;
    if (!r.ok || !j?.ok) return { ok: false, reason: j?.description || `Telegram returned ${r.status}` };
    return { ok: true };
  } catch {
    return { ok: false, reason: 'Could not reach Telegram.' };
  }
}

/** Answers a callback_query so Telegram stops showing the button's loading spinner. */
export async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text: text?.slice(0, 200) }),
  }).catch(() => {});
}
