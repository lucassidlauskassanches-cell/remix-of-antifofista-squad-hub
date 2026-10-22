# Project rules
- Training calendar and logbook rules live in a client-safe training-logbook module shared by UI and server validation, so week isolation and edit permissions stay consistent.
- Structured plan updates preserve the start date unless the trainer explicitly changes it; logbook history is independent and must never be deleted by plan updates.
- Registration scoring, retroactive-date and streak rules live in the client-safe registro-rules module, shared by optimistic UI and server calculation to prevent divergent scores.
- Daily mutations share a serialized queue and replay pending optimistic patches over server snapshots; focus/reconnect reads must not overwrite pending edits.
- Travel dates are separate RLS-protected neutral-day records, not rewrites of daily history; trainers are authorized through assertCanManageStudent.
- Rest countdowns persist absolute deadlines and recalculate on visibility changes, so throttled timers cannot lose elapsed time.