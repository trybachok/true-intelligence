import Joi, { type CustomHelpers } from 'joi';

export const reportDateSchema = Joi.string()
  .pattern(/^(?!0000)[0-9]{4}-[0-9]{2}-[0-9]{2}$/)
  .custom((value: string, helpers) => {
    const parsed = new Date(value + 'T00:00:00Z');
    if (
      !Number.isFinite(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== value
    ) {
      return helpers.error('date.format');
    }
    return value;
  });

export function validateReportPeriod<T extends { from: string; to: string }>(
  value: T,
  helpers: CustomHelpers,
) {
  return value.from <= value.to ? value : helpers.error('any.invalid');
}
