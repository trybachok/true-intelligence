const demoCompanies = [
  { name: 'Север', branches: ['Центральный', 'Западный', 'Полярный', 'Озёрный', 'Снежный'] },
  { name: 'Юг', branches: ['Южный', 'Курортный', 'Приморский', 'Солнечный', 'Виноградный', 'Долинный'] },
  { name: 'Восток', branches: ['Рассветный', 'Речной', 'Вокзальный', 'Горный', 'Тихий', 'Нагорный', 'Лесной'] },
  { name: 'Запад', branches: ['Парковый', 'Мостовой', 'Портовый', 'Каштановый', 'Университетский', 'Торговый', 'Кольцевой', 'Бульварный'] },
  { name: 'Северо-Восток', branches: ['Таёжный', 'Сосновый', 'Иней', 'Кедровый', 'Охотский', 'Сопочный', 'Горизонт', 'Каменистый', 'Морозный'] },
  { name: 'Северо-Запад', branches: ['Балтийский', 'Маяк', 'Верфь', 'Форт', 'Дюнный', 'Ладожский', 'Карельский', 'Морской', 'Приозёрный', 'Янтарный'] },
  { name: 'Юго-Восток', branches: ['Степной', 'Родниковый', 'Предгорный', 'Ореховый', 'Рубежный', 'Садовый', 'Луговой'] },
  { name: 'Юго-Запад', branches: ['Заречный', 'Липовый', 'Ратушный', 'Полевой', 'Абрикосовый', 'Площадь Мира', 'Сиреневый', 'Роща'] },
];

export class LoadDemoData1795536000001 {
  async up(queryRunner) {
    await queryRunner.query(`
      CREATE TABLE demo_data_ids (
        company_ids integer[] NOT NULL,
        branch_ids integer[] NOT NULL,
        user_ids integer[] NOT NULL,
        review_ids integer[] NOT NULL
      );
    `);

    await queryRunner.query(`
      WITH demo_companies AS (
        SELECT entry->>'name' AS name, entry->'branches' AS branches, position
        FROM jsonb_array_elements($1::jsonb) WITH ORDINALITY AS companies(entry, position)
      ), new_companies AS (
        INSERT INTO companies (name)
        SELECT name FROM demo_companies ORDER BY position
        RETURNING id, name
      ), demo_branches AS (
        SELECT c.id AS company_id, branch.name, d.position, branch.position AS branch_position,
          (d.position - 1) * 10 + branch.position - 1 AS branch_offset
        FROM new_companies c
        JOIN demo_companies d ON d.name = c.name
        CROSS JOIN LATERAL jsonb_array_elements_text(d.branches)
          WITH ORDINALITY AS branch(name, position)
      ), new_branches AS (
        INSERT INTO branches (company_id, name)
        SELECT company_id, name FROM demo_branches ORDER BY position, branch_position
        RETURNING id, company_id, name
      ), demo_accounts AS (
        SELECT account_number,
          CASE WHEN account_number = 1 THEN 'example.test'
            ELSE 'demo-' || account_number || '.example.test' END AS email_domain
        FROM generate_series(1, 10) AS accounts(account_number)
      ), new_users AS (
        INSERT INTO users (company_id, email, password_hash, role)
        SELECT NULL, 'admin@' || email_domain, '$2b$12$y6NP/VPJ6nRGum6AULE1Le2B5EGe4dInPHAfQI3prO6kNeZHzbtoi', 'admin'
        FROM demo_accounts
        UNION ALL
        SELECT c.id, 'client@' || a.email_domain, '$2b$12$QA7YiM0TE9KkZWu1gxEV1uwfdro.7f9YxZfPuzNMQMJ8jKkCCeJbe', 'client'
        FROM new_companies c
        JOIN demo_companies d ON d.name = c.name
        JOIN demo_accounts a ON d.position = 1 + (a.account_number - 1) % jsonb_array_length($1::jsonb)
        RETURNING id
      ), new_metrics AS (
        INSERT INTO daily_metrics (branch_id, metric_date, card_views, website_clicks, calls, route_requests)
        SELECT b.id, DATE '2026-11-24' - day_offset,
          100 + day_offset + d.branch_offset * 2,
          18 + day_offset % 7 + d.branch_offset % 12,
          3 + (day_offset + d.branch_offset) % 4, 8 + (day_offset + d.branch_offset) % 5
        FROM new_branches b
        JOIN demo_branches d ON d.company_id = b.company_id AND d.name = b.name
        CROSS JOIN generate_series(0, 29) AS day(day_offset)
      ), new_reviews AS (
        INSERT INTO reviews (branch_id, published_at, rating, body, status)
        SELECT b.id,
          TIMESTAMPTZ '2026-11-23 10:00:00+00' - (d.branch_offset % 14) * INTERVAL '1 day',
          review.rating, review.body, review.status
        FROM new_branches b
        JOIN demo_branches d ON d.company_id = b.company_id AND d.name = b.name
        JOIN (VALUES
          (0, 5, 'Быстро ответили на вопросы.', 'processed'),
          (1, 4, 'Удобное расположение.', 'pending'),
          (2, 3, 'Пришлось немного подождать.', 'pending'),
          (3, 5, 'Легко нашли вход по карте.', 'processed'),
          (4, 4, 'Уточнили время работы по телефону.', 'processed')
        ) AS review(position, rating, body, status) ON review.position = d.branch_offset % 5
        RETURNING id
      )
      INSERT INTO demo_data_ids (company_ids, branch_ids, user_ids, review_ids) VALUES (
        ARRAY(SELECT id FROM new_companies),
        ARRAY(SELECT id FROM new_branches),
        ARRAY(SELECT id FROM new_users),
        ARRAY(SELECT id FROM new_reviews)
      );
    `, [JSON.stringify(demoCompanies)]);
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
