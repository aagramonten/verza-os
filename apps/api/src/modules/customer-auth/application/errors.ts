export class InvalidCustomerAuthTokenError extends Error {
  constructor() {
    super('Invalid or expired customer authentication token');
    this.name = 'InvalidCustomerAuthTokenError';
  }
}

export class InvalidCustomerSessionError extends Error {
  constructor() {
    super('Invalid or expired customer session');
    this.name = 'InvalidCustomerSessionError';
  }
}
