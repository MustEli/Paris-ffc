import { type TFunction } from 'i18next';

/**
 * Backend errors carry a stable `code` (see packages/backend's various
 * `throw new XException({ message, code })` call sites) alongside their
 * English `message` — this is the client-side half of that contract.
 * Deliberately NOT a full backend-i18n system (no per-locale message
 * catalogs server-side, no Accept-Language handling) — the backend
 * still only ever speaks English; the app just knows how to re-say a
 * known subset of it. An error without a mapped code (or without a
 * code at all — network failures, anything not yet given one) falls
 * back to the raw English message rather than a generic string, so
 * nothing is ever silently hidden.
 */
const ERROR_CODE_KEYS: Record<string, string> = {
  'shift.on_break': 'apiErrors.shift.on_break',
  'shift.not_active': 'apiErrors.shift.not_active',
  'shift.already_active': 'apiErrors.shift.already_active',
  'shift.break_already_active': 'apiErrors.shift.break_already_active',
  'shift.short_break_used_up': 'apiErrors.shift.short_break_used_up',
  'shift.no_break_to_end': 'apiErrors.shift.no_break_to_end',
  'floor_task.box_prep_merged': 'apiErrors.floorTask.box_prep_merged',
  'floor_task.already_open': 'apiErrors.floorTask.already_open',
  'floor_task.not_yours': 'apiErrors.floorTask.not_yours',
  'floor_task.already_ended': 'apiErrors.floorTask.already_ended',
  'floor_task.already_paused': 'apiErrors.floorTask.already_paused',
  'floor_task.not_paused': 'apiErrors.floorTask.not_paused',
  'reception.missing_required_fields': 'apiErrors.reception.missing_required_fields',
  'issue_report.missing_required_fields': 'apiErrors.issueReport.missing_required_fields',
  'seller_stock.not_ready_for_self_putaway': 'apiErrors.sellerStock.not_ready_for_self_putaway',
};

/**
 * Translates a known error code if we have one, otherwise falls back to
 * the backend's own (English) message. Takes a bare `Error` with an
 * optional `code` (ApiError's actual shape) rather than importing
 * ApiError itself, so every `{error && <Text>{error.message}</Text>}`
 * call site can switch to this without also needing an `instanceof`
 * check or a cast — react-query types a mutation's error as a plain
 * `Error`, even though it's always really an ApiError in practice here.
 */
export function translateError(error: { message: string; code?: string }, t: TFunction): string {
  const key = error.code ? ERROR_CODE_KEYS[error.code] : undefined;
  return key ? t(key) : error.message;
}
