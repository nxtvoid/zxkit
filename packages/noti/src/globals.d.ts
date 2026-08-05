declare global {
  /** Component tests drive the store from outside React, so they set it themselves. */
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}

export {}
