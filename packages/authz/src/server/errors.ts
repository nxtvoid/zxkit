export class AccessDeniedError extends Error {
  code: 'UNAUTHORIZED' | 'FORBIDDEN'

  constructor(message: string, code: 'UNAUTHORIZED' | 'FORBIDDEN') {
    super(message)
    this.name = 'AccessDeniedError'
    this.code = code
  }
}
