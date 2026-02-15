# Removal & Refactoring Plan

## Overview

This document outlines the systematic removal of unnecessary features from the Audiobookshelf fork and the refactoring needed to align with our new vision.

**Status:** Planning phase
**Last Updated:** 2026-02-15

---

## Features to Remove

### 1. Podcasts (Complete Removal)

**Why:** We only work with audio files (audiobooks, YouTube MP3s). Podcasts with RSS feeds, auto-download, and episode management are not needed.

**Components to Remove:**

#### Backend
- [ ] `server/controllers/PodcastController.js` (or similar)
- [ ] `server/models/Podcast.js` and `PodcastEpisode.js`
- [ ] `server/routes/podcasts.js`
- [ ] Podcast-specific database tables/migrations
- [ ] RSS feed parsing logic
- [ ] Auto-download cron jobs/schedulers
- [ ] Podcast episode management APIs

#### Frontend
- [ ] `client/pages/podcasts/**/*` (podcast pages)
- [ ] Podcast components (`components/podcasts/**/*`)
- [ ] Podcast-specific store modules (`store/podcasts.js`)
- [ ] Navigation menu items for podcasts
- [ ] Podcast settings UI

#### Database
- [ ] `podcasts` table
- [ ] `podcast_episodes` table
- [ ] Related foreign keys and indexes
- [ ] Migration to remove these tables

**Verification:**
- Run full-text search for "podcast" (case-insensitive)
- Check for API endpoints mentioning podcasts
- Test that library still works without podcast features

**Estimated Effort:** Medium (3-5 days)
**Risk:** Low (isolated feature)

---

### 2. Narrators (Complete Removal)

**Why:** Not relevant for our use case. Authors are sufficient.

**Components to Remove:**

#### Backend
- [ ] Narrator field in book/audio model
- [ ] Narrator filtering/querying logic
- [ ] Narrator API endpoints
- [ ] Narrator database columns

#### Frontend
- [ ] Narrator display in UI
- [ ] Narrator filter controls
- [ ] Narrator search/autocomplete
- [ ] Narrator detail pages (if any)

#### Database
- [ ] `narrator` column in `books` table (or wherever it exists)
- [ ] `narrators` table (if exists as separate entity)
- [ ] Migration to drop narrator columns

**Search Terms:**
- "narrator"
- "narrated by"
- "voice actor"

**Estimated Effort:** Small (1-2 days)
**Risk:** Low (simple field removal)

---

### 3. Collections (Complete Removal)

**Why:** We use Playlists only for organization. Collections are redundant.

**Components to Remove:**

#### Backend
- [ ] `server/controllers/CollectionController.js`
- [ ] `server/models/Collection.js`
- [ ] `server/routes/collections.js`
- [ ] Collection management APIs
- [ ] Collection-book relationships

#### Frontend
- [ ] `client/pages/collections/**/*`
- [ ] Collection components
- [ ] Collection store module
- [ ] Navigation menu for collections
- [ ] Collection creation/edit UI

#### Database
- [ ] `collections` table
- [ ] `collection_books` junction table
- [ ] Related migrations

**Important:** Provide migration path if users have existing collections
- Option 1: Convert collections → playlists automatically
- Option 2: Export collections as JSON before removal
- Option 3: Show warning, allow manual migration

**Estimated Effort:** Medium (3-4 days)
**Risk:** Medium (may have existing user data)

---

## Refactoring: Series → Playlists

**Why:** "Playlists" is more intuitive for our use case than "Series"

**This is a rename, not a removal.** Keep all functionality, just change terminology.

### Components to Rename:

#### Backend
- [ ] Rename `Series` model to `Playlist` (or keep internal name, change API responses)
- [ ] Update API endpoints: `/api/series` → `/api/playlists`
- [ ] Update response fields: `seriesId` → `playlistId`, etc.
- [ ] Keep database table as-is initially (rename in later migration)

#### Frontend
- [ ] Update all UI text: "Series" → "Playlists"
- [ ] Rename components: `SeriesCard.vue` → `PlaylistCard.vue`
- [ ] Update store modules: `series.js` → `playlists.js`
- [ ] Update navigation: "Series" tab → "Playlists"
- [ ] Update icons (if series-specific icons exist)

#### Database
- [ ] **Phase 1:** Keep table name as `series`, only change application layer
- [ ] **Phase 2:** Rename table `series` → `playlists` (later migration)
- [ ] Update documentation and comments

**Backward Compatibility:**
- Consider supporting both `series` and `playlists` in API temporarily
- Add deprecation warnings for old endpoints
- Full removal of old terminology in v2.0

**Estimated Effort:** Medium (4-6 days)
**Risk:** Medium (affects many parts of codebase)

---

## Terminology Updates: Books → Audios

**Why:** We're not just managing books, but all audio content (YouTube, podcasts-as-audio, audiobooks)

**Approach:** Gradual rollout. Prioritize user-facing UI first, internals later.

### Phase 1: UI Text Updates
- [ ] Update page titles: "Books" → "Audios"
- [ ] Update navigation: "My Books" → "My Audios"
- [ ] Update button text: "Add Book" → "Add Audio"
- [ ] Update help text and tooltips
- [ ] Update placeholder text

### Phase 2: Code Comments & Documentation
- [ ] Update code comments referencing "books"
- [ ] Update API documentation
- [ ] Update README and user guides

### Phase 3: Internals (Low Priority)
- [ ] Consider renaming models (or add aliases)
- [ ] Consider renaming API endpoints (with backward compat)
- [ ] Consider renaming database tables (future major version)

**Note:** Internal code can keep "book" terminology if renaming is too invasive. Prioritize user-facing text.

**Estimated Effort:** Small-Medium (2-4 days for UI)
**Risk:** Low (cosmetic changes)

---

## Removal Strategy & Principles

### 1. Search First
Before removing anything, search the entire codebase:
```bash
# Search for feature name (case-insensitive)
rg -i "podcast" --type js --type vue
rg -i "narrator" --type js --type vue
rg -i "collection" --type js --type vue
```

### 2. Remove in Layers
Follow this order:
1. **Frontend UI** - remove visible components first
2. **API Routes** - remove endpoints (breaks frontend)
3. **Controllers & Logic** - remove business logic
4. **Models** - remove data models
5. **Database** - remove tables/columns last (write migration)

### 3. Test After Each Layer
- Run the app after each removal
- Test that remaining features still work
- Check for console errors
- Run test suite (if exists)

### 4. Keep Migration Path
For features with user data (Collections):
- Announce removal in advance
- Provide export/migration tools
- Keep migration script in codebase
- Document in CHANGELOG

### 5. Document Everything
- Update CLAUDE.md with removed features
- Update README
- Update API documentation
- Add comments explaining why code was removed (in commit messages)

---

## Migration Scripts Needed

### 1. Collections → Playlists Migration
If users have existing collections, convert them:

```sql
-- Example migration
INSERT INTO playlists (name, description, created_at)
SELECT name, description, created_at FROM collections;

-- Migrate relationships
INSERT INTO playlist_books (playlist_id, book_id)
SELECT playlist_id, book_id FROM collection_books
JOIN playlists ON collections.id = collection_books.collection_id;
```

**Script location:** `server/migrations/XXXX-migrate-collections-to-playlists.js`

### 2. Remove Podcasts
```sql
-- Remove podcast data
DROP TABLE IF EXISTS podcast_episodes;
DROP TABLE IF EXISTS podcasts;

-- Clean up any foreign keys in libraries or users table
ALTER TABLE libraries DROP COLUMN IF EXISTS default_podcast_settings;
```

**Script location:** `server/migrations/XXXX-remove-podcasts.js`

### 3. Remove Narrators
```sql
-- Remove narrator column from books
ALTER TABLE books DROP COLUMN IF EXISTS narrator;

-- If narrators was a separate table
DROP TABLE IF EXISTS narrators;
```

**Script location:** `server/migrations/XXXX-remove-narrators.js`

---

## Order of Operations

Recommended sequence to minimize breakage:

1. **Phase 1: Documentation & Setup**
   - ✅ Write PRD (this doc)
   - ✅ Write removal plan
   - ✅ Update CLAUDE.md with context
   - [ ] Set up TypeScript (✅ already done)
   - [ ] Create feature branch: `feature/cleanup-and-refactor`

2. **Phase 2: Remove Podcasts**
   - Day 1-2: Remove frontend podcast UI
   - Day 3: Remove backend podcast routes & controllers
   - Day 4: Remove podcast models & database schema
   - Day 5: Test, fix issues, commit

3. **Phase 3: Remove Narrators**
   - Day 1: Search & identify all narrator references
   - Day 2: Remove frontend narrator UI
   - Day 3: Remove backend narrator logic & database
   - Day 4: Test, commit

4. **Phase 4: Remove Collections → Migrate to Playlists**
   - Day 1: Write migration script (collections → playlists)
   - Day 2-3: Remove frontend collection UI
   - Day 4: Remove backend collection routes & controllers
   - Day 5: Remove collection models & database schema
   - Day 6: Test migration, test app, commit

5. **Phase 5: Rename Series → Playlists**
   - Day 1-2: Update frontend text & components
   - Day 3: Update API response fields (keep endpoint names for now)
   - Day 4-5: Update store & state management
   - Day 6: Test, commit

6. **Phase 6: Terminology Update (Books → Audios)**
   - Day 1-2: Update all frontend UI text
   - Day 3: Update documentation
   - Day 4: Test, commit

7. **Phase 7: Final Cleanup**
   - Search for any remaining references
   - Update CHANGELOG
   - Update README
   - Merge to master (or main branch)

**Total Estimated Time:** 3-4 weeks (15-20 working days)

---

## Risks & Mitigation

### Risk 1: Breaking Existing User Data
**Mitigation:**
- Write migration scripts before removal
- Test migrations on backup databases
- Provide rollback scripts
- Document migration process

### Risk 2: Missing References
**Mitigation:**
- Comprehensive search before removal
- Use TypeScript to catch missing references
- Run full test suite
- Manual QA testing

### Risk 3: Third-party Dependencies
**Mitigation:**
- Check if removed features have external dependencies
- Update dependencies if needed
- Remove unused npm packages

### Risk 4: Mobile Apps (if they exist)
**Mitigation:**
- Check if mobile apps rely on removed features
- Update mobile apps in parallel
- Version API carefully

---

## Testing Checklist

After each removal phase:

### Automated Tests
- [ ] Run test suite: `npm test`
- [ ] Run type-check: `npm run type-check`
- [ ] Check for console errors in dev mode

### Manual QA
- [ ] Login works
- [ ] Library displays correctly
- [ ] Audio playback works
- [ ] Search works
- [ ] Playlists work (after rename)
- [ ] Tags work
- [ ] Authors work
- [ ] Statistics display
- [ ] User management & permissions work
- [ ] Mobile responsive UI works

### Database
- [ ] Migrations run successfully
- [ ] No orphaned data
- [ ] Foreign keys intact
- [ ] Indexes still valid

---

## Success Criteria

**This removal plan is complete when:**
- ✅ All podcast features removed
- ✅ All narrator references removed
- ✅ All collection features removed (or migrated to playlists)
- ✅ "Series" renamed to "Playlists" throughout UI
- ✅ "Books" renamed to "Audios" in user-facing text
- ✅ All tests passing
- ✅ No console errors
- ✅ App runs smoothly with remaining features
- ✅ Documentation updated
- ✅ CHANGELOG updated

---

## Notes for AI Assistants

When working on removals:

1. **Always search first** - use `rg -i "feature_name"` to find all references
2. **Remove incrementally** - one layer at a time (UI → API → Logic → DB)
3. **Test frequently** - after each significant removal
4. **Document changes** - update this file with progress
5. **Commit often** - small, focused commits with clear messages
6. **Check for TypeScript errors** - run `npm run type-check` regularly
7. **Update CLAUDE.md** - if you discover new patterns or pitfalls

**Tracking progress:**
- Update checkboxes in this document as you complete tasks
- Add notes about challenges or gotchas
- Keep git commit messages detailed

---

## Progress Tracking

### Podcasts Removal
- [ ] Frontend UI removed
- [ ] API routes removed
- [ ] Controllers removed
- [ ] Models removed
- [ ] Database schema removed
- [ ] Tests updated
- [ ] Documentation updated

### Narrators Removal
- [ ] Frontend UI removed
- [ ] Backend logic removed
- [ ] Database schema removed
- [ ] Tests updated
- [ ] Documentation updated

### Collections Removal
- [ ] Migration script written
- [ ] Frontend UI removed
- [ ] API routes removed
- [ ] Controllers removed
- [ ] Models removed
- [ ] Database schema removed
- [ ] Tests updated
- [ ] Documentation updated

### Series → Playlists Rename
- [ ] Frontend text updated
- [ ] Components renamed
- [ ] Store updated
- [ ] API responses updated
- [ ] Documentation updated
- [ ] Tests updated

### Books → Audios Terminology
- [ ] UI text updated
- [ ] Navigation updated
- [ ] Help text updated
- [ ] Documentation updated

---

## Questions / Decisions Needed

1. **Should we keep backward-compatible API endpoints during transition?**
   - Keep `/api/series` and add `/api/playlists`?
   - Or hard-break to `/api/playlists` only?

2. **What to do with existing collections in user databases?**
   - Auto-migrate to playlists?
   - Warn users and let them migrate manually?

3. **Should we rename database tables or just keep internal naming?**
   - `books` table → `audios` table?
   - Or keep `books` internally, just change UI?

4. **Version number after cleanup?**
   - Major version bump (v3.0.0)?
   - Minor version (v2.38.0)?

---

## Appendix: Search Commands

Useful commands for finding references:

```bash
# Search for podcasts
rg -i "podcast" --type js --type vue -g '!node_modules' -g '!dist'

# Search for narrators
rg -i "narrator" --type js --type vue -g '!node_modules' -g '!dist'

# Search for collections
rg -i "collection" --type js --type vue -g '!node_modules' -g '!dist'

# Search for series
rg -i "series" --type js --type vue -g '!node_modules' -g '!dist'

# Search in database migrations
rg -i "podcast" server/migrations/

# Count occurrences
rg -i "podcast" --count-matches
```
