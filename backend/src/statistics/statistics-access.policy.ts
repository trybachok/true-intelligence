import { Policy } from '@nestjs/authorization';
import type { AuthUser } from '../auth/auth-user.js';

@Policy()
export class StatisticsAccessPolicy {
  import(user: AuthUser | null): boolean {
    return user?.role === 'admin';
  }
}
