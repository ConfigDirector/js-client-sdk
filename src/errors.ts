export class ConfigDirectorConnectionError extends Error {
  public override readonly name: string = "ConnectionError";
  public readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;

    Object.setPrototypeOf(this, ConfigDirectorConnectionError.prototype);
  }
}

export class ConfigDirectorValidationError extends Error {
  public override readonly name: string = "ValidationError";

  constructor(message: string) {
    super(message);

    Object.setPrototypeOf(this, ConfigDirectorValidationError.prototype);
  }
}
