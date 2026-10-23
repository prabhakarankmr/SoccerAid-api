export interface TokenPairEntity {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResultEntity extends TokenPairEntity {
  isNewUser: boolean;
  user: { id: string; phone: string; name: string | null };
}
