type UserIdentity = { id: number; email: string };

export type AuthUser = UserIdentity &
  ({ role: 'admin'; companyId: null } | { role: 'client'; companyId: number });

declare module '@nestjs/authentication' {
  interface AuthenticationTypes {
    user: AuthUser;
    refreshTokens: false;
  }
}
