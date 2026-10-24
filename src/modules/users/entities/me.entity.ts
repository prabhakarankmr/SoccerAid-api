export interface MeEntity {
  id: string;
  phone: string;
  name: string | null;
  username: string | null;
  bio: string | null;
  avatarUrl: string | null;
  player: { id: string; displayName: string; preferredPosition: string | null } | null;
}
