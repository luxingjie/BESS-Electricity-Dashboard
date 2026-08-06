import type { z } from "zod";

export class RequestValidationError extends Error {
  readonly status = 422;
  readonly code = "INVALID_INPUT";

  constructor(readonly issues: unknown) {
    super("请求字段不符合要求");
  }
}

export class MalformedJsonError extends Error {
  readonly status = 422;
  readonly code = "INVALID_JSON";

  constructor() {
    super("请求体必须是有效的 JSON");
  }
}

export function parseWithSchema<T>(result: z.ZodSafeParseResult<T>): T {
  if (!result.success) throw new RequestValidationError(result.error.flatten());
  return result.data;
}

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new MalformedJsonError();
  }
}
