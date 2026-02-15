# Product Requirements Document (PRD)

## Project Overview

### Context
This is a **fork of Audiobookshelf**, repurposed and streamlined for a specific use case: organizing and consuming audio content from YouTube videos, audiobooks, and custom audio files with heavy emphasis on transcripts, search, organization, and statistics.

### Project Name
**Audiobookshelf Fork** (working name - may rename to reflect audio-focused nature)

### Core Mission
Create a self-hosted platform for:
- Managing audio content (YouTube videos as MP3, audiobooks, custom audio)
- Searching and navigating through transcripts
- Organizing content with tags, authors, and playlists
- Cross-device synchronization with bookmarking
- Sharing content with granular access control
- Comprehensive statistics and analytics
- Deep integration with Obsidian for note-taking

---

## What We're Building

### Content Types Supported
1. **YouTube Videos** (converted to audio/MP3)
   - With transcripts extracted and stored
   - Searchable, taggable, organizable
2. **Audiobooks**
   - Traditional audiobook files
   - With or without transcripts
3. **Custom Audio Files**
   - Any audio content the user uploads
   - With optional transcripts

### Core Features (Keep & Enhance)

#### 1. Audio Library Management
- **Current name:** "Books" tab
- **Future name:** "Audios" (gradual rollout)
- Display, browse, filter, search through all audio content
- Rich metadata: title, author, tags, description, cover art
- Transcript storage and display

#### 2. Organization System

**Three pillars of organization:**

1. **Authors**
   - Group content by creator/author
   - YouTube channel creators count as authors
   - Statistics per author

2. **Tags**
   - Flexible, user-defined tagging
   - Multi-tag support
   - Filter and search by tags
   - Tag hierarchy/nesting (future consideration)

3. **Playlists** (renamed from "Series")
   - Primary method of organizing content into collections
   - User-defined playlists
   - Can contain any mix of content types
   - Shareable with access control
   - Playlist-level statistics

**Organization philosophy:** Keep it simple. No collections, no complicated hierarchies. Just Authors, Tags, and Playlists.

#### 3. Transcripts & Search

**Critical feature:**
- Full transcript storage for all audio content
- Full-text search across all transcripts
- Highlight and jump to specific transcript sections
- Export transcripts
- Timestamp-synced playback (click transcript line → jump to that time)

**Future enhancement:**
- Advanced transcript querying (semantic search, keyword extraction)
- Transcript editing and corrections
- Multi-language transcript support

#### 4. Obsidian Integration

**Goal:** Deep integration for knowledge management
- Tag notes on specific audio segments
- Link audio timestamps to Obsidian notes
- Bi-directional linking (Obsidian → Audio timestamps, Audio → Obsidian notes)
- Export summaries/transcripts to Obsidian vault
- Structured data format for interoperability

**Implementation approach:** (To be designed)
- Obsidian plugin for audiobookshelf?
- API endpoints for note syncing?
- File-based integration via shared folders?

#### 5. Playback & Synchronization

**Cross-device sync:**
- Playback position synced across devices
- Bookmarks synced
- Playlists synced
- Settings synced

**Playback features:**
- Variable speed playback
- Sleep timer
- Bookmarking with notes
- Jump forward/backward (configurable intervals)
- Chapter navigation (if chapters exist)

#### 6. Sharing & Access Control

**Multi-user with granular permissions:**
- Create users with different access levels
- Share specific playlists with specific users
- Hide/show content per user
- Public links for sharing (optional)
- Per-user listening statistics

**Use case:**
- Host content privately
- Share curated playlists with friends/colleagues
- Control what each person can access
- Track who's listening to what

#### 7. Statistics & Analytics

**Comprehensive statistics at multiple levels:**

**Per User:**
- Total listening time
- Listening streaks (daily/weekly)
- Most-listened content
- Progress tracking (what % completed)
- Listening history timeline
- Device usage breakdown

**Per Audio Track:**
- Total plays
- Total listening time
- Completion rate
- Popular segments (most-replayed parts via transcript clicks)
- User engagement metrics

**Per Author:**
- Total content by author
- Total listening time across all their content
- Most popular works
- User engagement with this author

**Per Playlist:**
- Total listening time for playlist
- Completion rates
- Most popular items in playlist
- User engagement

**Global/Library-wide:**
- Total content (count, hours)
- Total listening time across all users
- Most popular content
- Growth over time
- Active users

**Dashboard:**
- Visual analytics dashboard
- Charts, graphs, trends
- Exportable reports

---

## What We're Removing

### Features to Remove (See `docs/Removal-Plan.md` for details)

1. **Podcasts** - Complete removal
   - Podcast tab
   - RSS feed management
   - Auto-download features
   - Podcast-specific UI/logic

2. **Narrators** - Not needed
   - Narrator field
   - Narrator filtering
   - Narrator pages

3. **Collections** - Replaced by Playlists only
   - Collections tab
   - Collection management UI
   - Collection-specific logic

4. **Series** - Renamed to Playlists
   - Keep the functionality
   - Rename everywhere: "Series" → "Playlists"
   - Update UI, API, database schema

---

## Terminology Changes

| Old Term | New Term | Status |
|----------|----------|--------|
| Books | Audios | Gradual rollout |
| Series | Playlists | Planned |
| Narrators | (removed) | Planned |
| Collections | (removed) | Planned |
| Podcasts | (removed) | Planned |

---

## Future Enhancements (Not Now, But Document)

### YouTube Auto-Download & Processing
**Vision:** Automatically download YouTube videos as audio with transcripts

**Workflow:**
1. User provides YouTube URL (video or playlist)
2. System automatically:
   - Downloads video as MP3
   - Extracts transcript (YouTube captions or speech-to-text)
   - Creates metadata (title, author = channel, description, thumbnail)
   - Adds to library as new audio
3. User can organize into playlists, tag, etc.

**Triggers:**
- Manual: paste URL, click download
- Automatic: monitor YouTube channels/playlists for new videos
- Bulk import: import entire channel history

**Technical considerations:**
- youtube-dl / yt-dlp integration
- Transcript extraction (YouTube API or Whisper for speech-to-text)
- Storage management
- Rate limiting / quota management

### Advanced Transcript Features
- AI-powered summarization
- Keyword extraction
- Automatic tagging based on content
- Multi-language support
- Speaker diarization (who said what)

### Enhanced Obsidian Integration
- Native Obsidian plugin
- Real-time note syncing
- Automatic summary generation to notes
- Citation format (link to audio timestamp)

---

## Success Metrics

**Must-haves for v1.0:**
- ✅ All podcasts features removed
- ✅ Narrators removed
- ✅ Collections removed
- ✅ Series renamed to Playlists
- ✅ "Books" terminology updated to "Audios" in UI
- ✅ Transcript search working
- ✅ Basic statistics dashboard
- ✅ Sharing & access control functional
- ✅ Cross-device sync working

**Future milestones:**
- YouTube auto-download working
- Obsidian integration v1
- Advanced analytics dashboard
- Mobile app (if not already present)

---

## User Personas

### Primary User: Self (Content Curator)
- Consumes hours of YouTube content, audiobooks, podcasts
- Needs organization and structure
- Wants to search transcripts to find specific information
- Takes notes in Obsidian, wants integration
- Shares curated playlists with others
- Wants detailed analytics on listening habits

### Secondary Users: Friends/Colleagues (Shared Access)
- Receives shared playlists
- Limited access to specific content
- Can track their own listening progress
- May or may not take notes

---

## Technical Architecture

### Stack (Inherited from Audiobookshelf)
- **Backend:** Node.js, Express
- **Database:** SQLite (Sequelize ORM)
- **Frontend:** Nuxt.js (Vue.js)
- **Authentication:** Passport.js

### Key Components
1. **Audio Processing Pipeline**
   - File upload/import
   - Metadata extraction
   - Transcript generation/import
   - Storage management

2. **Search Engine**
   - Full-text search (SQLite FTS? Elasticsearch?)
   - Transcript indexing
   - Tag/author/playlist filtering

3. **Statistics Engine**
   - Listening event tracking
   - Aggregation and rollup
   - Dashboard rendering

4. **Sync Engine**
   - Real-time sync via WebSockets (Socket.io)
   - Conflict resolution
   - Offline support

5. **Obsidian Integration Layer**
   - API endpoints for note syncing
   - File-based export/import
   - Plugin development (future)

---

## API Design Principles

- RESTful where possible
- WebSocket for real-time sync
- GraphQL consideration for complex queries (future)
- Well-documented with OpenAPI/Swagger
- Obsidian-friendly endpoints (simple, standardized)

---

## UI/UX Principles

### Simplicity First
- Three-pillar organization (Authors, Tags, Playlists)
- Clean, focused interface
- No overwhelming options

### Search-First
- Prominent search bar
- Transcript search integrated into main search
- Quick filters (tags, authors, playlists)

### Mobile-Friendly
- Responsive design (already exists in Audiobookshelf)
- Native mobile apps (future consideration)

### Data-Driven
- Statistics visible throughout the app
- Progress indicators everywhere
- Visual feedback for actions

---

## Roadmap

### Phase 1: Cleanup (Current)
- Set up TypeScript infrastructure ✅
- Document PRD ✅
- Create removal plan ✅
- Begin removing podcasts, narrators, collections
- Rename Series → Playlists
- Update terminology: Books → Audios

### Phase 2: Core Enhancement (Next 3-6 months)
- Improve transcript search
- Build statistics dashboard
- Refine sharing & access control
- Stabilize core functionality

### Phase 3: Integration (6-12 months)
- Obsidian integration v1
- Enhanced analytics
- Performance optimizations

### Phase 4: Automation (12+ months)
- YouTube auto-download
- AI-powered features (summarization, tagging)
- Advanced transcript features

---

## Open Questions / Decisions Needed

1. **Final project name?**
   - Keep "Audiobookshelf" or rebrand?
   - Suggestions: AudioVault, TranscriptHub, AudioOrg, etc.

2. **Obsidian integration approach?**
   - Plugin, API, file-based, or all three?

3. **Mobile apps?**
   - Does Audiobookshelf already have mobile apps?
   - Keep, enhance, or rebuild?

4. **Self-hosting only or cloud option?**
   - Keep self-hosted only (current)
   - Offer cloud-hosted option (future)?

5. **Transcript generation?**
   - Manual upload only
   - Automatic via Whisper (local)
   - Automatic via cloud API (costs money)

6. **Database migration strategy?**
   - How to handle existing Audiobookshelf databases?
   - Migration scripts needed?

---

## Constraints & Considerations

### What We Keep
- Multi-user support with permissions
- Existing playback features
- Library management
- File storage system
- Authentication & authorization
- Mobile-responsive UI

### What We Don't Need
- Podcast-specific features (RSS, auto-download)
- E-book reading features (if present)
- Narrators
- Collections
- Overly complex hierarchies

### Performance Targets
- Fast transcript search (< 500ms)
- Real-time sync (< 1s latency)
- Support for 10,000+ audio files
- Support for 100+ concurrent users (multi-tenant)

---

## Conclusion

This fork transforms Audiobookshelf from a general-purpose audiobook/podcast server into a **focused, transcript-centric audio organization and consumption platform** with deep note-taking integration and comprehensive analytics.

**Core principles:**
1. **Simplicity:** Authors, Tags, Playlists only
2. **Searchability:** Transcripts are first-class citizens
3. **Integration:** Deep Obsidian integration for knowledge work
4. **Analytics:** Comprehensive statistics everywhere
5. **Sharing:** Granular access control for collaboration
6. **Sync:** Seamless cross-device experience

**Next steps:** See `docs/Removal-Plan.md` for the cleanup roadmap.
