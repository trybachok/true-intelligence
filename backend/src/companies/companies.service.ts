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
    const [company] = await this.database.query<Company[]>(
      'SELECT id FROM companies WHERE id = $1',
      [companyId],
    );

    if (!company) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Компания или филиал не найдены',
      });
    }

    await this.authorization.authorize(
      CompanyAccessPolicy,
      'read',
      user,
      company.id,
    );
    return this.database.query<Branch[]>(
      'SELECT id, company_id AS "companyId", name FROM branches WHERE company_id = $1 ORDER BY id',
      [company.id],
    );
  }
}
