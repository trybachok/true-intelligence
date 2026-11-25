import Joi from 'joi';

const maxPostgresInteger = 2_147_483_647;

export const resourceIdSchema = Joi.string<number>()
  .pattern(/^[0-9]+$/)
  .custom((value: string, helpers) => {
    const id = Number(value);
    if (id < 1) return helpers.error('number.min', { limit: 1 });
    if (id > maxPostgresInteger) {
      return helpers.error('number.max', { limit: maxPostgresInteger });
    }
    return id;
  });
