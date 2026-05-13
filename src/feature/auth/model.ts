import { t } from 'elysia'

export const credentialsBodySchema = t.Object({
  email: t.String({ minLength: 3, maxLength: 255 }),
  password: t.String({ minLength: 8, maxLength: 256 }),
})

export const loginResponseDataSchema = t.Object({
  token: t.String(),
  expiresInSec: t.Number(),
})

export const registerResponseDataSchema = t.Object({
  userId: t.String(),
})
