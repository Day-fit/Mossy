export class AppError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, message: string, body: unknown = { message }) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.body = body;
  }
}

export function requireValue<T>(value: T | null | undefined, status: number, message: string): T {
  if (value === null || value === undefined) throw new AppError(status, message);
  return value;
}
