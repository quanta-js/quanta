# @quantajs/core

## 2.0.0-beta.2

### Major Changes

- feat(core): add method to store for restoring initial state
    - Introduced initialStateMap to track original state for each store
    - Implemented method on the store instance to restore the state
    - Triggered reactivity manually for both updated and deleted properties
    - Extended Store and StoreInstance types to include

    refactor(react): support multiple stores in QuantaProvider and useStore hook
    - Updated QuantaProvider to accept a object instead of a single
    - Modified QuantaContext to expose all stores by name
    - Updated hook to require store name and handle missing stores

## 2.0.0-beta.1

### Major Changes

- A clean, performant React integration that makes QuantaJS as easy to use in React, with minimal setup and maximum functionality for the QuantaJS state management library.

## 1.0.1-beta.0

### Patch Changes

- chore: migrate project to monorepo structure with pnpm, changesets, and improved OSS workflows

## 1.0.0

### Patch Changes

- chore: migrate project to monorepo structure with pnpm, changesets, and improved OSS workflows
