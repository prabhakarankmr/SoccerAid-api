export interface TeamSummaryEntity {
  id: string;
  name: string;
  code: string;
  logoUrl: string | null;
  contactNumber: string | null;
  place: string | null;
  captain: { id: string; displayName: string } | null;
}
