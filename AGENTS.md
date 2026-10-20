# Project rules
- Training calendar and logbook rules live in a client-safe training-logbook module shared by UI and server validation, so week isolation and edit permissions stay consistent.
- Structured plan updates preserve the start date unless the trainer explicitly changes it; logbook history is independent and must never be deleted by plan updates.