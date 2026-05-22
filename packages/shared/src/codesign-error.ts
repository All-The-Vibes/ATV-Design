import type { CodesignErrorCode } from './error-codes';

export class CodesignError extends Error {
  constructor(
    message: string,
    // Accept a known registry code (preferred) or a free-form string (backward compat).
    public readonly code: CodesignErrorCode | string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'CodesignError';
  }
}
