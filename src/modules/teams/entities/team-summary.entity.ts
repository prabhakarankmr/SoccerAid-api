export interface TeamSummaryEntity {
  id: string;
  name: string;
  code: string;
  logoUrl: string | null;
  contactNumber: string | null;
  place: string | null;
  captain: { id: string; displayName: string } | null;
  // So the frontend can hide owner-only actions (edit captain, add/remove player) instead of
  // showing a control that would just 403 — not an auth boundary itself, the backend still
  // enforces ownership on every mutation regardless of what the client shows (§9.5).
  ownerId: string;
}
