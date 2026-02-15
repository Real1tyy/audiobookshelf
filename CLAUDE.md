# Audiobookshelf AI Development Guide

## Project Overview
Audiobookshelf is a self-hosted audiobook and podcast server built with Node.js (backend) and Nuxt.js (frontend).

## TypeScript Migration Strategy

**IMPORTANT: We are gradually migrating to TypeScript. DO NOT blindly rename .js files to .ts.**

### The Approach: Gradual, Safe Migration

We use an incremental TypeScript adoption strategy that allows us to migrate file-by-file without breaking existing code:

1. **TypeScript is configured with `allowJs: true`** - existing .js files work alongside .ts files
2. **Type-checking is initially disabled for JS files** (`checkJs: false`)
3. **Convert files to TypeScript ONLY when you're actively working on them**
4. **Never batch-rename files** - TypeScript will immediately start type-checking and expose hundreds of errors

### When Working on Code

**If you're modifying a .js file:**
- First, check if it can be safely converted to .ts
- Add proper TypeScript types as you work
- Rename to .ts when the file is properly typed
- Update any imports that reference this file

**If you're creating new code:**
- Always create new files as .ts
- Use proper TypeScript types from the start
- Follow the existing patterns in converted files

**If you encounter type errors:**
- Fix them properly, don't use `any` everywhere
- Use `unknown` instead of `any` when the type is truly unknown
- Add `// @ts-expect-error` with explanation only for legitimate edge cases

### What Files to Prioritize

Convert in this order of priority:
1. **New files** - always .ts
2. **Utility functions and helpers** - usually easy to type
3. **Models and data structures** - high value for type safety
4. **Route handlers and controllers** - medium complexity
5. **Complex business logic** - requires careful typing
6. **Legacy/stable code** - lowest priority, only if touching it

### Technical Details

See `docs/Typescript.md` for:
- Complete tsconfig.json setup
- Common migration patterns
- Type definitions for the project
- Troubleshooting guide

### Progressive Enhancement

Our goal is **100% TypeScript coverage** across the full stack, but we get there gradually:
- Month 1-2: Infrastructure setup, new files in TS, convert low-hanging fruit
- Month 3-6: Convert files as we touch them, build up type definitions
- Month 6-12: Enable stricter checks, convert remaining files
- Month 12+: Full strict mode, comprehensive type coverage

**The key principle: Every file you touch should be left better than you found it.**

## Development Workflow

### Code Style
- Use ES6+ features (const/let, arrow functions, async/await)
- Prefer functional patterns over imperative where reasonable
- Keep functions small and focused
- Add comments for complex business logic only

### Git Workflow
- Commit messages should be clear and descriptive
- Reference issue numbers when applicable
- Keep commits focused and atomic

### Testing
- Run tests before committing: `npm test`
- Add tests for new functionality
- Update tests when modifying existing code

## Project Structure

```
/server          - Backend Node.js application
/client          - Frontend Nuxt.js application
/docs            - Documentation
/test            - Test files
```

Refer to existing code patterns and architecture when implementing new features.
