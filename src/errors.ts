export class ConfigDirectorConnectionError extends Error {
  public override readonly name: string = "ConfigDirectorConnectionError";
  public readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.status = status;

    Object.setPrototypeOf(this, ConfigDirectorConnectionError.prototype);
  }
}

export class ConfigDirectorValidationError extends Error {
  public override readonly name: string = "ConfigDirectorValidationError";

  constructor(message: string) {
    super(message);

    Object.setPrototypeOf(this, ConfigDirectorValidationError.prototype);
  }
}

export const isFetchErrorFatal = (fetchError: any): boolean => {
  if (fetchError instanceof DOMException) {
    const domError = fetchError as DOMException;
    if (domError.name === "NotAllowedError") {
      return true;
    }
  } else if (fetchError instanceof TypeError) {
    return true;
  }

  return false;
};
