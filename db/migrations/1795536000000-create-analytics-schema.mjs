export class CreateAnalyticsSchema1795536000000 {
  async up(queryRunner) {
    await queryRunner.query(`
      CREATE TABLE companies (
        id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        name text NOT NULL
      );

      CREATE TABLE branches (
        id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        company_id integer NOT NULL REFERENCES companies (id),
        name text NOT NULL
      );

      CREATE INDEX branches_company_id_idx ON branches (company_id, id);

      CREATE TABLE users (
        id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        company_id integer REFERENCES companies (id),
        email text NOT NULL UNIQUE CHECK (email = lower(email)),
        password_hash text NOT NULL,
        role text NOT NULL,
        CHECK (
          (role = 'admin' AND company_id IS NULL) OR
          (role = 'client' AND company_id IS NOT NULL)
        )
      );

      CREATE TABLE daily_metrics (
        branch_id integer NOT NULL REFERENCES branches (id),
        metric_date date NOT NULL,
        card_views integer NOT NULL CHECK (card_views >= 0),
        website_clicks integer NOT NULL CHECK (website_clicks >= 0),
        calls integer NOT NULL CHECK (calls >= 0),
        route_requests integer NOT NULL CHECK (route_requests >= 0),
        PRIMARY KEY (branch_id, metric_date)
      );

      CREATE INDEX daily_metrics_date_idx ON daily_metrics (metric_date);

      CREATE TABLE reviews (
        id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        branch_id integer NOT NULL REFERENCES branches (id),
        published_at timestamptz NOT NULL,
        rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
        body text NOT NULL,
        status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed'))
      );

      CREATE INDEX reviews_branch_published_at_idx ON reviews (branch_id, published_at);
      CREATE INDEX reviews_published_at_idx ON reviews (published_at);
    `);
  }

  async down(queryRunner) {
    await queryRunner.query('DROP TABLE reviews, daily_metrics, users, branches, companies');
  }
}
