# TypeScript Migration Guide

## Overview

This document details the technical strategy for gradually migrating Audiobookshelf from JavaScript to TypeScript **without breaking existing code**.

## The Problem with Naive Migration

**DO NOT** do this:
```bash
# WRONG - This will immediately break everything
find . -name "*.js" -exec rename 's/\.js$/.ts/' {} \;
```

When you rename `.js` to `.ts`, TypeScript immediately starts type-checking with stricter rules:
- Import/export syntax must be correct
- Implicit `any` types may be forbidden
- `require()` might not work as expected
- Missing type definitions cause errors
- All dependencies need type declarations

Result: **Hundreds or thousands of type errors that must be fixed immediately.**

## The Right Approach: Incremental Migration

### Phase 1: TypeScript Infrastructure Setup

#### 1. Install TypeScript and Type Dependencies

```bash
pnpm add -D typescript @types/node @types/express
```

Add more `@types/*` packages as needed for your dependencies.

#### 2. Create `tsconfig.json` at Project Root

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],

    // CRITICAL: Allow JS and TS to coexist
    "allowJs": true,
    "checkJs": false,

    // Don't emit - we still run .js files directly
    "noEmit": true,

    // Start lenient, tighten later
    "strict": false,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true,

    // Paths
    "baseUrl": ".",
    "paths": {
      "@/*": ["server/*"],
      "@server/*": ["server/*"]
    }
  },
  "include": [
    "server/**/*",
    "index.js"
  ],
  "exclude": [
    "node_modules",
    "client",
    "dist",
    "build"
  ]
}
```

#### 3. Add Client-Specific tsconfig (if needed)

The Nuxt.js client may already have TypeScript configuration. Check `client/tsconfig.json`.

#### 4. Add TypeScript Scripts to package.json

```json
{
  "scripts": {
    "type-check": "tsc --noEmit",
    "type-check:watch": "tsc --noEmit --watch"
  }
}
```

### Phase 2: Gradual File Conversion

#### When to Convert a File

Convert a `.js` file to `.ts` when:
1. **You're actively modifying it** - add types as you work
2. **It's a utility/helper** - usually straightforward to type
3. **It's a new file** - always start with `.ts`
4. **Dependencies are typed** - files it imports are already `.ts` or have types

**Don't convert** when:
- You're just reading the file
- It has many untyped dependencies
- It's complex legacy code you're not touching
- It would create a cascade of required changes

#### Conversion Process

**Step 1: Make a copy and rename**
```bash
cp server/utils/someFile.js server/utils/someFile.ts
```

**Step 2: Fix obvious type issues**
- Add parameter types to functions
- Add return type annotations
- Replace `require()` with `import` if needed
- Add types for variables where non-obvious

**Step 3: Run type-check**
```bash
pnpm type-check
```

**Step 4: Fix errors iteratively**
- Start with easy fixes (add explicit types)
- Use `unknown` instead of `any` for truly unknown types
- Add `@ts-expect-error` with explanation only when necessary

**Step 5: Delete the old `.js` file**
```bash
rm server/utils/someFile.js
```

**Step 6: Update imports in other files**

If other files import this, update them:
```javascript
// Before
const { someFunction } = require('./utils/someFile')

// After
const { someFunction } = require('./utils/someFile.ts')
// or better, convert the importing file too:
import { someFunction } from './utils/someFile'
```

### Common Patterns

#### Pattern 1: Simple Utility Function

```javascript
// Before: utils/hash.js
function hashPassword(password) {
  return someHashingLib.hash(password)
}
module.exports = { hashPassword }
```

```typescript
// After: utils/hash.ts
export function hashPassword(password: string): string {
  return someHashingLib.hash(password)
}
```

#### Pattern 2: Express Route Handler

```javascript
// Before: routes/books.js
router.get('/books/:id', (req, res) => {
  const book = findBook(req.params.id)
  res.json(book)
})
```

```typescript
// After: routes/books.ts
import { Request, Response } from 'express'

interface BookParams {
  id: string
}

router.get('/books/:id', (req: Request<BookParams>, res: Response) => {
  const book = findBook(req.params.id)
  res.json(book)
})
```

#### Pattern 3: Model/Data Class

```javascript
// Before: models/Book.js
class Book {
  constructor(data) {
    this.id = data.id
    this.title = data.title
    this.author = data.author
  }
}
```

```typescript
// After: models/Book.ts
interface BookData {
  id: string
  title: string
  author: string
}

export class Book {
  id: string
  title: string
  author: string

  constructor(data: BookData) {
    this.id = data.id
    this.title = data.title
    this.author = data.author
  }
}
```

#### Pattern 4: Dealing with `any`

```typescript
// AVOID - defeats the purpose
function processData(data: any): any {
  return data.something
}

// BETTER - use unknown and type guards
function processData(data: unknown): ProcessedData {
  if (!isValidData(data)) {
    throw new Error('Invalid data')
  }
  return {
    value: data.something
  }
}

function isValidData(data: unknown): data is { something: string } {
  return (
    typeof data === 'object' &&
    data !== null &&
    'something' in data &&
    typeof data.something === 'string'
  )
}
```

### Phase 3: Tightening the Screws

Once you have ~60-80% of files converted, gradually enable stricter checks:

#### Update tsconfig.json

```json
{
  "compilerOptions": {
    // Enable strict mode gradually
    "strict": true,

    // Or enable individual strict checks one at a time:
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,

    // Additional helpful checks
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

Enable these **one at a time**, fix errors, then move to the next.

### Phase 4: Shared Type Definitions

Create shared type definition files for domain models:

```typescript
// types/models.ts
export interface User {
  id: string
  username: string
  email: string
  createdAt: Date
}

export interface Book {
  id: string
  title: string
  author: string
  duration: number
  // ...
}

export interface Library {
  id: string
  name: string
  books: Book[]
  // ...
}
```

Import and use these across the codebase:
```typescript
import { User, Book } from '@/types/models'
```

## Troubleshooting

### "Cannot find module" errors

**Symptom:** `Cannot find module './someFile' or its corresponding type declarations`

**Solution:**
1. Check if the file exists
2. Add `.ts` extension to import if needed
3. Ensure `moduleResolution: "NodeNext"` in tsconfig
4. Check `paths` configuration in tsconfig

### Module/Import Errors

**Symptom:** Mix of `require()` and `import` causing issues

**Solution:**
- Stick with `import/export` in `.ts` files
- Use `esModuleInterop: true` in tsconfig
- Convert `module.exports` to `export`
- Convert `require()` to `import`

### Implicit `any` Warnings

**Symptom:** "Parameter 'x' implicitly has an 'any' type"

**Solution:**
1. Add explicit type annotation
2. Or add `noImplicitAny: false` to tsconfig temporarily
3. Fix gradually as you work on files

### Type Definition Not Found

**Symptom:** "Could not find a declaration file for module 'some-package'"

**Solution:**
```bash
# Try installing types
pnpm add -D @types/some-package

# If no types exist, create a declaration file
# types/some-package.d.ts
declare module 'some-package' {
  export function someFunction(arg: string): void
}
```

## Measuring Progress

Track conversion progress:

```bash
# Count .ts vs .js files in server
echo "TypeScript files: $(find server -name '*.ts' | wc -l)"
echo "JavaScript files: $(find server -name '*.js' | wc -l)"

# Calculate percentage
```

Set incremental goals:
- Month 1: 20% converted
- Month 3: 50% converted
- Month 6: 80% converted
- Month 12: 100% converted

## AI Assistant Guidelines

When working as an AI assistant on this codebase:

1. **Always check file extension** - Is this .js or .ts?

2. **When modifying .js files:**
   - Consider if it's worth converting to .ts
   - If yes: convert it properly with types
   - If no: keep it as .js, don't half-convert

3. **When creating new files:**
   - Always use .ts extension
   - Add proper types from the start
   - Follow existing patterns in other .ts files

4. **When you see type errors:**
   - Fix them properly, don't ignore with `any`
   - Add type guards for runtime validation
   - Use `unknown` for truly unknown data

5. **Track your progress:**
   - Mention in commit messages when converting files
   - Update this doc if you find better patterns
   - Share learnings in code reviews

## Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/)
- [Migrating from JavaScript](https://www.typescriptlang.org/docs/handbook/migrating-from-javascript.html)
- [Express TypeScript Guide](https://expressjs.com/en/advanced/typescript.html)

## Summary

**The Golden Rule:** Leave every file better than you found it.

- ✅ Convert files when you're working on them
- ✅ Add types to new code
- ✅ Improve types in existing code
- ❌ Don't blindly rename .js to .ts
- ❌ Don't use `any` as a cop-out
- ❌ Don't break existing functionality

This is a marathon, not a sprint. Gradual, steady progress wins.
