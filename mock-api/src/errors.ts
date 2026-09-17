export class AppError extends Error {
  readonly status: number;
  readonly body: unknown;
  readonly headers: Record<string, string>;

  constructor(status: number, message: string, body: unknown = { message }, headers: Record<string, string> = {}) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.body = body;
    this.headers = headers;
  }
}

export function requireValue<T>(value: T | null | undefined, status: number, message: string): T {
  if (value === null || value === undefined) throw new AppError(status, message);
  return value;
}
