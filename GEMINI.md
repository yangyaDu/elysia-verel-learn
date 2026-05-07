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

- Controllers should handle routing and request/response wrapping.
- Business logic should reside in Services.
- **Method Parameters**: Use class types (Parameter Objects) for service method inputs to simplify parameter passing and improve extensibility.
- **Return Type**: Services should return standard error codes (defined in `src/define/errDefine.ts`) and data as a tuple: `Promise<[ErrCodeT, Data | null]>`.

### Service Example

```typescript
// src/feature/example/service.ts
export class LoginParams {
  username!: string
  password!: string
}

export class ExampleService {
  async login(params: LoginParams): Promise<[ErrCodeT, LoginResponse | null]> {
    // ...
  }
}
```

## Infrastructure

- **PageIndex**: Used for PDF document indexing and reasoning.
- **MinIO**: Used for raw PDF storage.
- **DeepSeek**: Preferred LLM for general chat.
