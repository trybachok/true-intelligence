export class LoadDemoData1795536000001 {
  async up(queryRunner) {
    await queryRunner.query(`
      CREATE TABLE demo_data_ids (
        company_ids integer[] NOT NULL,
        branch_ids integer[] NOT NULL,
        user_ids integer[] NOT NULL,
        review_ids integer[] NOT NULL
      );

      WITH new_companies AS (
        INSERT INTO companies (name) VALUES ('Вымышленная компания Север'), ('Вымышленная компания Юг')
        RETURNING id, name
      ), new_branches AS (
        INSERT INTO branches (company_id, name)
        SELECT c.id, b.name
        FROM new_companies c
        JOIN (VALUES
          ('Вымышленная компания Север', 'Центральный'),
          ('Вымышленная компания Север', 'Западный'),
          ('Вымышленная компания Юг', 'Южный')
        ) AS b(company_name, name) ON b.company_name = c.name
        RETURNING id, name
      ), new_users AS (
        INSERT INTO users (company_id, email, password_hash, role) VALUES
          (NULL, 'admin@example.test', 'scrypt:2f375cbdacbc135072bfcac989f0f71e:07680be19323fdb6030fd5eb1fd4f9396f0839558e66c66040aa666e6fb3ab0f7d836d211c9931e6e52acf40322cc73134a0d44b055a6905f5deddee8c55f521', 'admin'),
          ((SELECT id FROM new_companies WHERE name = 'Вымышленная компания Север'),
            'client@example.test', 'scrypt:3758cd4e00c5ea0ef42f07b6849a60bc:b804fbd6d017962736720c43e930b138eb4b0b49df6182490643975d29830b25891c736cf661613a8677cc462e1c7dece7b9161c4474e46a6e48e138f2956cdf', 'client')
        RETURNING id
      ), new_metrics AS (
        INSERT INTO daily_metrics (branch_id, metric_date, card_views, website_clicks, calls, route_requests)
        SELECT b.id, DATE '2026-11-24' - day_offset,
          100 + day_offset, 18 + day_offset % 7, 3 + day_offset % 4, 8 + day_offset % 5
        FROM new_branches b
        CROSS JOIN generate_series(0, 29) AS day(day_offset)
      ), new_reviews AS (
        INSERT INTO reviews (branch_id, published_at, rating, body, status)
        SELECT b.id, r.published_at, r.rating, r.body, r.status
        FROM new_branches b
        JOIN (VALUES
          ('Центральный', TIMESTAMPTZ '2026-11-23 10:00:00+00', 5, 'Быстро ответили на вопросы.', 'processed'),
          ('Западный', TIMESTAMPTZ '2026-11-22 10:00:00+00', 4, 'Удобное расположение.', 'pending'),
          ('Южный', TIMESTAMPTZ '2026-11-21 10:00:00+00', 3, 'Пришлось немного подождать.', 'pending')
        ) AS r(branch_name, published_at, rating, body, status) ON r.branch_name = b.name
        RETURNING id
      )
      INSERT INTO demo_data_ids (company_ids, branch_ids, user_ids, review_ids) VALUES (
        ARRAY(SELECT id FROM new_companies),
        ARRAY(SELECT id FROM new_branches),
        ARRAY(SELECT id FROM new_users),
        ARRAY(SELECT id FROM new_reviews)
      );
    `);
  }

  async down(queryRunner) {
    const hasRecordedIds = await queryRunner.hasTable('demo_data_ids');
    // Earlier local runs used fixed negative IDs for demo rows.
    const [ids] = hasRecordedIds
      ? await queryRunner.query('SELECT company_ids, branch_ids, user_ids, review_ids FROM demo_data_ids')
      : [{
          company_ids: [-1, -2],
          branch_ids: [-1, -2, -3],
          user_ids: [-1, -2],
          review_ids: [-1, -2, -3],
        }];

    await queryRunner.query('DELETE FROM reviews WHERE id = ANY($1::integer[])', [ids.review_ids]);
    await queryRunner.query(`
      DELETE FROM daily_metrics WHERE branch_id = ANY($1::integer[])
        AND metric_date BETWEEN DATE '2026-11-24' - 29 AND DATE '2026-11-24'
    `, [ids.branch_ids]);
    await queryRunner.query('DELETE FROM users WHERE id = ANY($1::integer[])', [ids.user_ids]);
    await queryRunner.query('DELETE FROM branches WHERE id = ANY($1::integer[])', [ids.branch_ids]);
    await queryRunner.query('DELETE FROM companies WHERE id = ANY($1::integer[])', [ids.company_ids]);
    if (hasRecordedIds) {
      await queryRunner.query('DROP TABLE demo_data_ids');
    }
  }
}
