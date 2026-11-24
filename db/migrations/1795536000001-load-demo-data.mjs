export class LoadDemoData1795536000001 {
  async up(queryRunner) {
    await queryRunner.query(`
      INSERT INTO companies (id, name) OVERRIDING SYSTEM VALUE VALUES
        (-1, 'Вымышленная компания Север'),
        (-2, 'Вымышленная компания Юг');

      INSERT INTO branches (id, company_id, name) OVERRIDING SYSTEM VALUE VALUES
        (-1, -1, 'Центральный'),
        (-2, -1, 'Западный'),
        (-3, -2, 'Южный');

      INSERT INTO users (id, company_id, email, password_hash, role) OVERRIDING SYSTEM VALUE VALUES
        (-1, NULL, 'admin@example.test', 'scrypt:2f375cbdacbc135072bfcac989f0f71e:07680be19323fdb6030fd5eb1fd4f9396f0839558e66c66040aa666e6fb3ab0f7d836d211c9931e6e52acf40322cc73134a0d44b055a6905f5deddee8c55f521', 'admin'),
        (-2, -1, 'client@example.test', 'scrypt:3758cd4e00c5ea0ef42f07b6849a60bc:b804fbd6d017962736720c43e930b138eb4b0b49df6182490643975d29830b25891c736cf661613a8677cc462e1c7dece7b9161c4474e46a6e48e138f2956cdf', 'client');

      INSERT INTO daily_metrics (branch_id, metric_date, card_views, website_clicks, calls, route_requests)
      SELECT branch_id, DATE '2026-11-24' - day_offset,
        100 - branch_id * 5 + day_offset, 18 + day_offset % 7, 3 + day_offset % 4, 8 + day_offset % 5
      FROM unnest(ARRAY[-1, -2, -3]) AS branch(branch_id)
      CROSS JOIN generate_series(0, 29) AS day(day_offset);

      INSERT INTO reviews (id, branch_id, published_at, rating, body, status) OVERRIDING SYSTEM VALUE VALUES
        (-1, -1, TIMESTAMPTZ '2026-11-23 10:00:00+00', 5, 'Быстро ответили на вопросы.', 'processed'),
        (-2, -2, TIMESTAMPTZ '2026-11-22 10:00:00+00', 4, 'Удобное расположение.', 'pending'),
        (-3, -3, TIMESTAMPTZ '2026-11-21 10:00:00+00', 3, 'Пришлось немного подождать.', 'pending');
    `);
  }

  async down(queryRunner) {
    await queryRunner.query(`
      DELETE FROM reviews WHERE id IN (-1, -2, -3);
      DELETE FROM daily_metrics
      WHERE branch_id IN (-1, -2, -3)
        AND metric_date BETWEEN DATE '2026-11-24' - 29 AND DATE '2026-11-24';
      DELETE FROM users WHERE id IN (-1, -2);
      DELETE FROM branches WHERE id IN (-1, -2, -3);
      DELETE FROM companies WHERE id IN (-1, -2);
    `);
  }
}
