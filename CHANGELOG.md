# Changelog

All notable changes to this project. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions
follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-11-01

First release.

### Added

- `createScrollRing()` with `setData`, `scrollToIndex` and `destroy`.
- Fixed DOM node pool sized from the viewport; rows assigned to nodes with
  `row % poolSize`.
- Pool grows when the container gets taller, using `ResizeObserver`. It
  never shrinks.
- Without `ResizeObserver`, the window is capped at the pool size (with one
  logged error) so rows never share a node.
- Options: `container` (element or id), `itemHeight`, `renderItem`, `buffer`.
- TypeScript types; `renderItem` is typed with the item type.
- ESM and CommonJS builds with type definitions for both.
- Live demo and API docs on GitHub Pages; benchmark against a naive list
  (see `BENCHMARKS.md`).

[Unreleased]: https://github.com/sanil011/scrollring/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/sanil011/scrollring/releases/tag/v0.1.0
