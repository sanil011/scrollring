# Changelog

All notable changes to this project. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions
follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

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
- Demo page, and unit, component (jsdom) and browser (Playwright) tests.
