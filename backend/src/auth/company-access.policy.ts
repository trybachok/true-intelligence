import { Policy } from '@nestjs/authorization';
import type { AuthUser } from './auth-user.js';

@Policy()
export class CompanyAccessPolicy {
  read(user: AuthUser | null, companyId: number): boolean {
    return (
      user !== null && (user.role === 'admin' || user.companyId === companyId)
    );
  }
}
