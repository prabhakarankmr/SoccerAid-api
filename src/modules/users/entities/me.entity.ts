export interface MeEntity {
  id: string;
  phone: string;
  name: string | null;
  avatarUrl: string | null;
  player: { id: string; displayName: string; preferredPosition: string | null } | null;
}
