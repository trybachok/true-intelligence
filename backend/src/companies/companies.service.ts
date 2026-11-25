import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthorizationService } from '@nestjs/authorization';
import { DataSource } from 'typeorm';
import type { AuthUser } from '../auth/auth-user.js';
import { CompanyAccessPolicy } from '../auth/company-access.policy.js';

type Company = { id: number; name: string };
type Branch = { id: number; companyId: number; name: string };

@Injectable()
export class CompaniesService {
  constructor(
    private readonly database: DataSource,
    private readonly authorization: AuthorizationService,
  ) {}

  list(user: AuthUser) {
    return user.role === 'admin'
      ? this.database.query<Company[]>(
          'SELECT id, name FROM companies ORDER BY id',
        )
      : this.database.query<Company[]>(
          'SELECT id, name FROM companies WHERE id = $1',
          [user.companyId],
        );
  }

  async listBranches(user: AuthUser, companyId: number) {
    await this.requireReadableCompany(user, companyId);
    return this.database.query<Branch[]>(
      'SELECT id, company_id AS "companyId", name FROM branches WHERE company_id = $1 ORDER BY id',
      [companyId],
    );
  }

  async requireReadableCompany(user: AuthUser, companyId: number) {
    const [company] = await this.database.query<{ id: number }[]>(
      'SELECT id FROM companies WHERE id = $1',
      [companyId],
    );
    if (!company) throw this.notFound();
    await this.authorization.authorize(
      CompanyAccessPolicy,
      'read',
      user,
      company.id,
    );
  }

  async requireReadableBranch(user: AuthUser, branchId: number) {
    const [branch] = await this.database.query<{ companyId: number }[]>(
      'SELECT company_id AS "companyId" FROM branches WHERE id = $1',
      [branchId],
    );
    if (!branch) throw this.notFound();
    await this.authorization.authorize(
      CompanyAccessPolicy,
      'read',
      user,
      branch.companyId,
    );
    return branch;
  }

  private notFound() {
    return new NotFoundException({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Компания или филиал не найдены',
    });
  }
}
