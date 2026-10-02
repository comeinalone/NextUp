// Thrown for expected problems (wrong state, not found). The API layer will
// turn these into { error: { code, message } } with the right HTTP status.
export class ServiceError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}