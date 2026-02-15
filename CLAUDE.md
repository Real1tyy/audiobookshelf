# Audiobookshelf Fork - AI Development Guide

> **⚠️ IMPORTANT FOR AI ASSISTANTS:**
> This is a specialized fork with specific goals. Before making changes:
> 1. **Read `docs/PRD.md`** - understand what we're building
> 2. **Check `docs/Removal-Plan.md`** - know what to remove
> 3. **Review `docs/Typescript.md`** - follow migration strategy
>
> Don't assume this is vanilla Audiobookshelf. We're removing podcasts, narrators, and collections.

## Project Context

**This is a fork of [Audiobookshelf](https://github.com/advplyr/audiobookshelf)**, repurposed for a specific use case.

### What We're Building
A self-hosted platform for organizing and consuming **audio content** with heavy emphasis on:
- **YouTube videos** (converted to audio/MP3) with transcripts
- **Audiobooks** with searchable transcripts
- **Custom audio files** with metadata and organization
- **Deep Obsidian integration** for knowledge management
- **Comprehensive statistics** and listening analytics
- **Granular sharing** and access control

### What Makes This Different from Audiobookshelf
We're **streamlining and specializing** the codebase:

**Keeping & Enhancing:**
- Audio library management (Books → Audios)
- Multi-user support with permissions
- Cross-device sync and playback
- Authors, Tags, and **Playlists** (renamed from Series)
- Transcript search and navigation
- Statistics and analytics (greatly expanded)

**Removing:**
- ❌ **Podcasts** - complete removal (RSS, auto-download, episodes)
- ❌ **Narrators** - not needed for our use case
- ❌ **Collections** - using Playlists only for organization

### Core Organization Philosophy
**Three pillars only:**
1. **Authors** - creators, YouTube channels, narrators
2. **Tags** - flexible, user-defined tagging
3. **Playlists** - primary organization method (renamed from Series)

No collections, no complicated hierarchies. Keep it simple.

### **IMPORTANT: Read These Documents First**

Before making any significant changes, AI agents should read:

1. **`docs/PRD.md`** ⭐ **READ THIS FIRST**
   - Complete Product Requirements Document
   - Vision, goals, and what we're building
   - Features to keep vs. remove
   - Success metrics and roadmap
   - **This is the source of truth for project direction**

2. **`docs/Removal-Plan.md`**
   - Detailed removal strategy for podcasts, narrators, collections
   - Step-by-step migration plan
   - Database migration scripts
   - Testing checklist
   - **Use this when removing features**

3. **`docs/Typescript.md`**
   - TypeScript migration guide
   - Conversion patterns and best practices
   - Troubleshooting common issues
   - **Use this when converting .js → .ts files**

**Golden rule:** When in doubt about feature direction or architecture decisions, check `docs/PRD.md` first.

### Quick Start for AI Assistants

**First time working on this project?**
1. Read `docs/PRD.md` (10 min) - understand the vision
2. Skim `docs/Removal-Plan.md` (5 min) - know what's being removed
3. Review this file (CLAUDE.md) - understand development guidelines
4. Check `docs/Typescript.md` only when converting JS to TS

**When asked to implement a feature:**
1. Check if it aligns with `docs/PRD.md`
2. If it contradicts the PRD (e.g., "add podcast RSS feeds"), clarify with the user
3. If it's about removed features (podcasts/narrators/collections), reference the removal plan

**When asked to remove something:**
1. Check `docs/Removal-Plan.md` for the strategy
2. Follow the removal order: UI → API → Logic → Models → DB
3. Test after each layer

### Tech Stack
- **Backend:** Node.js, Express, SQLite (Sequelize ORM)
- **Frontend:** Nuxt.js (Vue.js)
- **Authentication:** Passport.js
- **Real-time:** Socket.io
- **Gradually migrating to TypeScript** (see below)

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
