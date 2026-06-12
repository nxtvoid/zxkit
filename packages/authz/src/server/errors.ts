export class AccessDeniedError extends Error {
  code: 'UNAUTHORIZED' | 'FORBIDDEN'

  constructor(message: string, code: 'UNAUTHORIZED' | 'FORBIDDEN') {
    super(message)
    this.name = 'AccessDeniedError'
    this.code = code
  }

  // Duck-typed check instead of bare `instanceof`: when a package manager
  // installs duplicate copies of this package (e.g. differing peer hashes),
  // errors thrown by one copy are not instances of the other copy's class.
  static is(error: unknown): error is AccessDeniedError {
    if (error instanceof AccessDeniedError) {
      return true
    }

    return (
      error instanceof Error &&
      error.name === 'AccessDeniedError' &&
      ('code' in error ? error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN' : false)
    )
  }
}
