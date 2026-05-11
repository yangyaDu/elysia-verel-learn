# Project Conventions

## Type Definitions (Request & Response)

All request and response bodies must follow this pattern:
1. Define the schema in `feature/{module}/model.ts` using Elysia's `t` schema.
2. Export the schema (e.g., `export const xxxSchema = t.Object(...)`).
3. Export the static type derived from the schema (e.g., `export type Xxx = typeof xxxSchema.static`).

### Example

```typescript
// src/feature/example/model.ts
import { t } from 'elysia'

export const loginRequestSchema = t.Object({
  username: t.String(),
  password: t.String()
})

export type LoginRequest = typeof loginRequestSchema.static
```

## Service Pattern

- Controllers should handle routing and simple parameter extraction/validation.
- Business logic (including default values) should reside in Services.
- **Method Parameters**: Use class types (Parameter Objects) for service method inputs.
- **Return Type**: Services should return an `ErrInfo` object (containing code and message) and data as a tuple: `Promise<[ErrInfo, Data | null]>`.

### Service Example

```typescript
// src/feature/example/service.ts
import { errCodeEnum, type ErrInfo } from '../../define/errDefine'

export class LoginParams {
  username!: string
  password!: string
}

export class ExampleService {
  async login(params: LoginParams): Promise<[ErrInfo, LoginResponse | null]> {
    // ...
    return [errCodeEnum.ERR_SUCCESS, { token: '...' }]
  }
}
```

### Controller Example

```typescript
// src/feature/example/controller.ts
  .post('/login', async ({ body }) => {
    const [err, data] = await exampleService.login(body)
    if (err.code !== errCodeEnum.ERR_SUCCESS.code) {
      throw new BusinessError(err)
    }
    return buildResponseBody(err, data)
  })
```

## Infrastructure

- **PageIndex**: Used for PDF document indexing and reasoning.
- **MinIO**: Used for raw PDF storage.
- **DeepSeek**: Preferred LLM for general chat.
