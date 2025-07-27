# Changelog

## 2.0.0-beta.1

### Major Changes

- A clean, performant React integration that makes QuantaJS as easy to use in React, with minimal setup and maximum functionality for the QuantaJS state management library.

### Patch Changes

- Updated dependencies
    - @quantajs/core@2.0.0-beta.1

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1-beta.0] - 2025-01-27

### Added

- Initial React integration for QuantaJS
- `useQuantaStore` hook for subscribing to QuantaJS stores
- `useStore` hook for accessing stores from context
- `useCreateStore` hook for creating component-scoped stores
- `QuantaProvider` component for providing stores to React components
- `QuantaContext` for React context integration
- Full TypeScript support with proper type inference
- Comprehensive documentation and examples

### Features

- Reactive state management with automatic React re-renders
- Support for selectors to prevent unnecessary re-renders
- Integration with QuantaJS core features (reactive, computed, watch)
- Easy-to-use API similar to popular state management libraries
- Component-scoped state management capabilities
- Context-based global state sharing
