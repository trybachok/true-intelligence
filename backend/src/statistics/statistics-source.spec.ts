import { SimulatedStatisticsSource } from './statistics-source.js';

describe('Имитация источника статистики', () => {
  const source = new SimulatedStatisticsSource();

  it('возвращает только дни пересечения с демонстрационным периодом', async () => {
    const input = { branchId: 7, from: '2026-10-25', to: '2026-10-27' };

    const rows = await source.fetchMetrics(input);
    expect(rows.map(({ branchId, date }) => ({ branchId, date }))).toEqual([
      { branchId: 7, date: '2026-10-26' },
      { branchId: 7, date: '2026-10-27' },
    ]);
    expect(await source.fetchMetrics(input)).toEqual(rows);
  });

  it('возвращает пустой ответ вне демонстрационного периода', async () => {
    expect(
      await source.fetchMetrics({
        branchId: 7,
        from: '2026-11-25',
        to: '2026-11-25',
      }),
    ).toEqual([]);
  });
});
