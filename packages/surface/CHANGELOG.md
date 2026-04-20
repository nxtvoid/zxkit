# Changelog

## 1.1.1

### Patch Changes

- Refine the typed modal API with better modal registry inference and safer instance handles for async and replace flows.

## 1.1.0

### Minor Changes

- Add typed modal definitions with `modal(...)`, async modal results with `pushModalAsync`, instance controls through `useModalControls`, and smoother instance-based modal replacement flows.

## 1.0.3

### Patch Changes

- Fix modal stack closing for multiple instances of the same modal and clean published package output.

## 1.0.2 - 2026-02-27

### Minor Changes

- **fix: resolve TS2742 portability errors in declaration emit**

## 1.0.1 - 2026-02-27

### Minor Changes

- fix type error in usePreservedForm

## [1.0.0] - 2026-02-25

### Added

- Initial release of `@zxkit/surface`
- `createResponsiveWrapper` for responsive Dialog/Drawer (SHADCN only)
- `usePreservedState` and `usePreservedForm` for state preservation
- `createPushModal` for router-style modal stack
- Full integration between both systems
- Initial documentation
