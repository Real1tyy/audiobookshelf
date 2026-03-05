import { z } from 'zod'
import { createZodClass } from '../zodHelpers'

const nullableStr = z.string().nullable().default(null)

const AudioMetaTagsSchema = z.object({
  tagAlbum: nullableStr,
  tagAlbumSort: nullableStr,
  tagArtist: nullableStr,
  tagArtistSort: nullableStr,
  tagGenre: nullableStr,
  tagTitle: nullableStr,
  tagTitleSort: nullableStr,
  tagSeries: nullableStr,
  tagSeriesPart: nullableStr,
  tagGrouping: nullableStr,
  tagTrack: nullableStr,
  tagDisc: nullableStr,
  tagSubtitle: nullableStr,
  tagAlbumArtist: nullableStr,
  tagDate: nullableStr,
  tagComposer: nullableStr,
  tagPublisher: nullableStr,
  tagComment: nullableStr,
  tagDescription: nullableStr,
  tagEncoder: nullableStr,
  tagEncodedBy: nullableStr,
  tagIsbn: nullableStr,
  tagLanguage: nullableStr,
  tagASIN: nullableStr,
  tagItunesId: nullableStr,
  tagEpisodeType: nullableStr,
  tagOverdriveMediaMarker: nullableStr,
  tagOriginalYear: nullableStr,
  tagReleaseCountry: nullableStr,
  tagReleaseType: nullableStr,
  tagReleaseStatus: nullableStr,
  tagISRC: nullableStr,
  tagMusicBrainzTrackId: nullableStr,
  tagMusicBrainzAlbumId: nullableStr,
  tagMusicBrainzAlbumArtistId: nullableStr,
  tagMusicBrainzArtistId: nullableStr
})

const PROBER_KEY_MAP: Record<string, string> = {
  file_tag_album: 'tagAlbum',
  file_tag_albumsort: 'tagAlbumSort',
  file_tag_artist: 'tagArtist',
  file_tag_artistsort: 'tagArtistSort',
  file_tag_genre: 'tagGenre',
  file_tag_title: 'tagTitle',
  file_tag_titlesort: 'tagTitleSort',
  file_tag_series: 'tagSeries',
  file_tag_seriespart: 'tagSeriesPart',
  file_tag_grouping: 'tagGrouping',
  file_tag_track: 'tagTrack',
  file_tag_disc: 'tagDisc',
  file_tag_subtitle: 'tagSubtitle',
  file_tag_albumartist: 'tagAlbumArtist',
  file_tag_date: 'tagDate',
  file_tag_composer: 'tagComposer',
  file_tag_publisher: 'tagPublisher',
  file_tag_comment: 'tagComment',
  file_tag_description: 'tagDescription',
  file_tag_encoder: 'tagEncoder',
  file_tag_encodedby: 'tagEncodedBy',
  file_tag_isbn: 'tagIsbn',
  file_tag_language: 'tagLanguage',
  file_tag_asin: 'tagASIN',
  file_tag_itunesid: 'tagItunesId',
  file_tag_episodetype: 'tagEpisodeType',
  file_tag_overdrive_media_marker: 'tagOverdriveMediaMarker',
  file_tag_originalyear: 'tagOriginalYear',
  file_tag_releasecountry: 'tagReleaseCountry',
  file_tag_releasetype: 'tagReleaseType',
  file_tag_releasestatus: 'tagReleaseStatus',
  file_tag_isrc: 'tagISRC',
  file_tag_musicbrainz_trackid: 'tagMusicBrainzTrackId',
  file_tag_musicbrainz_albumid: 'tagMusicBrainzAlbumId',
  file_tag_musicbrainz_albumartistid: 'tagMusicBrainzAlbumArtistId',
  file_tag_musicbrainz_artistid: 'tagMusicBrainzArtistId'
}

function fromProberData(payload: Record<string, unknown>): Record<string, string | null> {
  const result: Record<string, string | null> = {}
  for (const [proberKey, schemaKey] of Object.entries(PROBER_KEY_MAP)) {
    result[schemaKey] = (payload[proberKey] as string) || null
  }
  return result
}

function parseTrackOrDisc(value: string | null): { number: number | null; total: number | null } {
  const data = { number: null as number | null, total: null as number | null }
  if (!value) return data
  const parts = value.split('/').map((p) => Number(p))
  if (parts.length > 0 && !isNaN(parts[0])) data.number = Math.trunc(parts[0])
  if (parts.length > 1 && !isNaN(parts[1])) data.total = parts[1]
  return data
}

class AudioMetaTags extends createZodClass(AudioMetaTagsSchema) {
  /** Only return tags that are actually set (non-null) */
  toJSON(): Record<string, string> {
    const json: Record<string, string> = {}
    for (const key of Object.keys(AudioMetaTagsSchema.shape)) {
      const val = (this as any)[key]
      if (val) json[key] = val
    }
    return json
  }

  get trackNumAndTotal() { return parseTrackOrDisc(this.tagTrack) }
  get discNumAndTotal() { return parseTrackOrDisc(this.tagDisc) }
  get discNumber() { return this.discNumAndTotal.number }
  get discTotal() { return this.discNumAndTotal.total }
  get trackNumber() { return this.trackNumAndTotal.number }
  get trackTotal() { return this.trackNumAndTotal.total }

  setData(payload: Record<string, unknown>) {
    Object.assign(this, fromProberData(payload))
  }

  updateData(payload: Record<string, unknown>): boolean {
    const mapped = fromProberData(payload)
    let hasUpdates = false
    for (const [key, value] of Object.entries(mapped)) {
      if ((this as any)[key] !== value) {
        ;(this as any)[key] = value
        hasUpdates = true
      }
    }
    return hasUpdates
  }

  isEqual(other: AudioMetaTags | null): boolean {
    if (!other) return false
    for (const key of Object.keys(AudioMetaTagsSchema.shape)) {
      const a = (this as any)[key] || null
      const b = (other as any)[key] || null
      if (a !== b) return false
    }
    return true
  }
}

export = AudioMetaTags
