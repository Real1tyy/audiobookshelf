const { expect } = require('chai')

const FileMetadata = require('../../../server/objects/metadata/FileMetadata')
const AudioMetaTags = require('../../../server/objects/metadata/AudioMetaTags')
const AudioTrack = require('../../../server/objects/files/AudioTrack')
const AudioFile = require('../../../server/objects/files/AudioFile')
const EBookFile = require('../../../server/objects/files/EBookFile')
const LibraryFile = require('../../../server/objects/files/LibraryFile')
const DeviceInfo = require('../../../server/objects/DeviceInfo')
const Backup = require('../../../server/objects/Backup')
const Task = require('../../../server/objects/Task')
const PlaybackSession = require('../../../server/objects/PlaybackSession')
const EmailSettings = require('../../../server/objects/settings/EmailSettings')

describe('Zod Object Migration Regression Tests', () => {
  describe('FileMetadata', () => {
    it('should construct with defaults', () => {
      const fm = new FileMetadata()
      expect(fm.filename).to.be.null
      expect(fm.ext).to.be.null
      expect(fm.wasModified).to.be.false
    })

    it('should construct from data', () => {
      const fm = new FileMetadata({ filename: 'test.mp3', ext: '.mp3', path: '/a/test.mp3', relPath: 'test.mp3', size: 1024 })
      expect(fm.filename).to.equal('test.mp3')
      expect(fm.ext).to.equal('.mp3')
      expect(fm.format).to.equal('mp3')
      expect(fm.filenameNoExt).to.equal('test')
    })

    it('should serialize to JSON and back', () => {
      const data = { filename: 'test.mp3', ext: '.mp3', path: '/a/test.mp3', relPath: 'test.mp3', size: 1024, mtimeMs: 100, ctimeMs: 200, birthtimeMs: 50 }
      const fm = new FileMetadata(data)
      const json = fm.toJSON()
      expect(json.filename).to.equal('test.mp3')
      expect(json.size).to.equal(1024)
      // Round-trip
      const fm2 = new FileMetadata(json)
      expect(fm2.filename).to.equal(fm.filename)
      expect(fm2.size).to.equal(fm.size)
    })

    it('should clone', () => {
      const fm = new FileMetadata({ filename: 'a.mp3', ext: '.mp3' })
      const cloned = fm.clone()
      expect(cloned.filename).to.equal('a.mp3')
      cloned.filename = 'b.mp3'
      expect(fm.filename).to.equal('a.mp3')
    })

    it('should update and detect changes', () => {
      const fm = new FileMetadata({ filename: 'a.mp3', size: 100 })
      expect(fm.update({ size: 200 })).to.be.true
      expect(fm.size).to.equal(200)
      expect(fm.update({ size: 200 })).to.be.false
    })

    it('should setData', () => {
      const fm = new FileMetadata()
      fm.setData({ filename: 'test.mp3', ext: '.mp3', size: 500 })
      expect(fm.filename).to.equal('test.mp3')
      expect(fm.size).to.equal(500)
    })
  })

  describe('AudioMetaTags', () => {
    it('should construct with defaults', () => {
      const tags = new AudioMetaTags()
      expect(tags.tagAlbum).to.be.null
      expect(tags.tagArtist).to.be.null
    })

    it('should construct from data', () => {
      const tags = new AudioMetaTags({ tagAlbum: 'Test Album', tagArtist: 'Test Artist' })
      expect(tags.tagAlbum).to.equal('Test Album')
      expect(tags.tagArtist).to.equal('Test Artist')
    })

    it('should only serialize non-null tags', () => {
      const tags = new AudioMetaTags({ tagAlbum: 'Album', tagArtist: null })
      const json = tags.toJSON()
      expect(json.tagAlbum).to.equal('Album')
      expect(json).to.not.have.property('tagArtist')
    })

    it('should setData from prober format', () => {
      const tags = new AudioMetaTags()
      tags.setData({ file_tag_album: 'My Album', file_tag_artist: 'My Artist', file_tag_track: '3/10' })
      expect(tags.tagAlbum).to.equal('My Album')
      expect(tags.tagArtist).to.equal('My Artist')
      expect(tags.tagTrack).to.equal('3/10')
    })

    it('should parse track numbers', () => {
      const tags = new AudioMetaTags({ tagTrack: '3/10', tagDisc: '1/2' })
      expect(tags.trackNumber).to.equal(3)
      expect(tags.trackTotal).to.equal(10)
      expect(tags.discNumber).to.equal(1)
      expect(tags.discTotal).to.equal(2)
    })

    it('should detect equality', () => {
      const t1 = new AudioMetaTags({ tagAlbum: 'A', tagArtist: 'B' })
      const t2 = new AudioMetaTags({ tagAlbum: 'A', tagArtist: 'B' })
      const t3 = new AudioMetaTags({ tagAlbum: 'C', tagArtist: 'B' })
      expect(t1.isEqual(t2)).to.be.true
      expect(t1.isEqual(t3)).to.be.false
      expect(t1.isEqual(null)).to.be.false
    })

    it('should updateData and detect changes', () => {
      const tags = new AudioMetaTags({ tagAlbum: 'Old' })
      expect(tags.updateData({ file_tag_album: 'New' })).to.be.true
      expect(tags.tagAlbum).to.equal('New')
      expect(tags.updateData({ file_tag_album: 'New' })).to.be.false
    })

    it('should clone', () => {
      const tags = new AudioMetaTags({ tagAlbum: 'Original' })
      const cloned = tags.clone()
      expect(cloned.tagAlbum).to.equal('Original')
      cloned.tagAlbum = 'Changed'
      expect(tags.tagAlbum).to.equal('Original')
    })
  })

  describe('AudioTrack', () => {
    it('should construct with defaults', () => {
      const track = new AudioTrack()
      expect(track.index).to.be.null
      expect(track.duration).to.be.null
    })

    it('should setFromStream', () => {
      const track = new AudioTrack()
      track.setFromStream('Title', 120, '/hls/123/output.m3u8')
      expect(track.index).to.equal(1)
      expect(track.startOffset).to.equal(0)
      expect(track.duration).to.equal(120)
      expect(track.title).to.equal('Title')
      expect(track.mimeType).to.equal('application/vnd.apple.mpegurl')
    })

    it('should serialize', () => {
      const track = new AudioTrack()
      track.setFromStream('Test', 60, '/hls/test')
      const json = track.toJSON()
      expect(json.title).to.equal('Test')
      expect(json.duration).to.equal(60)
    })
  })

  describe('AudioFile', () => {
    it('should construct with defaults', () => {
      const af = new AudioFile()
      expect(af.metadata).to.not.be.null
      expect(af.metaTags).to.not.be.null
      expect(af.chapters).to.deep.equal([])
      expect(af.manuallyVerified).to.be.false
    })

    it('should construct from data with nested objects', () => {
      const data = {
        index: 1,
        ino: '123',
        metadata: { filename: 'ch1.mp3', ext: '.mp3' },
        metaTags: { tagAlbum: 'Book Title' },
        duration: 3600,
        chapters: [{ id: 0, start: 0, end: 1800, title: 'Ch 1' }]
      }
      const af = new AudioFile(data)
      expect(af.metadata.filename).to.equal('ch1.mp3')
      expect(af.metadata.format).to.equal('mp3')
      expect(af.metaTags.tagAlbum).to.equal('Book Title')
      expect(af.chapters).to.have.length(1)
    })

    it('should serialize with nested objects and mimeType', () => {
      const af = new AudioFile({
        metadata: { filename: 'test.mp3', ext: '.mp3' },
        metaTags: { tagArtist: 'Author' }
      })
      const json = af.toJSON()
      expect(json.metadata).to.have.property('filename', 'test.mp3')
      expect(json.metaTags).to.have.property('tagArtist', 'Author')
      expect(json.mimeType).to.be.a('string')
    })

    it('should support cdNumFromFilename migration', () => {
      const af = new AudioFile({ cdNumFromFilename: 2 })
      expect(af.discNumFromFilename).to.equal(2)
    })

    it('should syncChapters and detect changes', () => {
      const af = new AudioFile({ chapters: [{ id: 0, title: 'A' }] })
      expect(af.syncChapters([{ id: 0, title: 'B' }])).to.be.true
      expect(af.chapters[0].title).to.equal('B')
      expect(af.syncChapters([{ id: 0, title: 'B' }])).to.be.false
    })

    it('should clone', () => {
      const af = new AudioFile({ metadata: { filename: 'a.mp3', ext: '.mp3' }, duration: 100 })
      const cloned = af.clone()
      expect(cloned.metadata.filename).to.equal('a.mp3')
      expect(cloned.duration).to.equal(100)
      cloned.duration = 200
      expect(af.duration).to.equal(100)
    })
  })

  describe('EBookFile', () => {
    it('should construct from data', () => {
      const eb = new EBookFile({ ino: '123', metadata: { filename: 'book.epub', ext: '.epub' } })
      expect(eb.metadata.filename).to.equal('book.epub')
      expect(eb.ebookFormat).to.equal('epub')
      expect(eb.isEpub).to.be.true
    })

    it('should serialize', () => {
      const eb = new EBookFile({ ino: '123', metadata: { filename: 'book.epub', ext: '.epub' } })
      const json = eb.toJSON()
      expect(json.ino).to.equal('123')
      expect(json.metadata).to.have.property('filename', 'book.epub')
    })
  })

  describe('LibraryFile', () => {
    it('should construct from data', () => {
      const lf = new LibraryFile({ ino: '456', metadata: { filename: 'ch1.mp3', ext: '.mp3' } })
      expect(lf.metadata.filename).to.equal('ch1.mp3')
    })

    it('should include fileType in toJSON', () => {
      const lf = new LibraryFile({ ino: '456', metadata: { filename: 'cover.jpg', ext: '.jpg' } })
      const json = lf.toJSON()
      expect(json).to.have.property('fileType')
    })
  })

  describe('DeviceInfo', () => {
    it('should construct with defaults', () => {
      const di = new DeviceInfo()
      expect(di.id).to.be.null
      expect(di.browserName).to.be.null
    })

    it('should construct from data', () => {
      const di = new DeviceInfo({ id: 'abc', browserName: 'Chrome', osName: 'Linux' })
      expect(di.id).to.equal('abc')
      expect(di.browserName).to.equal('Chrome')
    })

    it('should strip nulls from toJSON', () => {
      const di = new DeviceInfo({ id: 'abc', browserName: null, osName: 'Linux' })
      const json = di.toJSON()
      expect(json.id).to.equal('abc')
      expect(json).to.not.have.property('browserName')
      expect(json.osName).to.equal('Linux')
    })

    it('should generate deviceDescription', () => {
      const di = new DeviceInfo({ model: 'Pixel', sdkVersion: '33', clientVersion: '1.0' })
      expect(di.deviceDescription).to.equal('Pixel SDK 33 / v1.0')
    })

    it('should generate temp device id', () => {
      const di = new DeviceInfo({ userId: 'user1', browserName: 'Chrome' })
      const tempId = di.getTempDeviceId()
      expect(tempId).to.match(/^temp-/)
    })

    it('should detect updates via bidirectional diff', () => {
      const di = new DeviceInfo({ id: 'abc', deviceId: 'dev1', browserName: 'Chrome', osName: 'Linux' })
      const hasUpdates = di.update({ browserName: 'Firefox', osName: 'Linux' })
      expect(hasUpdates).to.be.true
      expect(di.browserName).to.equal('Firefox')
    })
  })

  describe('Backup', () => {
    it('should construct from details array format', () => {
      const backup = new Backup({
        details: ['2024-01-01T1200', 'sqlite', String(Date.now()), '2.5.0'],
        fullPath: '/backups/2024-01-01T1200.audiobookshelf'
      })
      expect(backup.id).to.equal('2024-01-01T1200')
      expect(backup.key).to.equal('sqlite')
      expect(backup.serverVersion).to.equal('2.5.0')
      expect(backup.filename).to.equal('2024-01-01T1200.audiobookshelf')
    })

    it('should handle key=1 migration', () => {
      const backup = new Backup({
        details: ['id1', 1, String(Date.now())],
        fullPath: '/backups/id1.audiobookshelf'
      })
      expect(backup.key).to.be.null
    })

    it('should setData', () => {
      const backup = new Backup()
      backup.setData('/metadata/backups')
      expect(backup.id).to.be.a('string')
      expect(backup.key).to.equal('sqlite')
      expect(backup.backupDirPath).to.equal('/metadata/backups')
      expect(backup.filename).to.include('.audiobookshelf')
    })

    it('should serialize', () => {
      const backup = new Backup()
      backup.setData('/metadata/backups')
      const json = backup.toJSON()
      expect(json.id).to.equal(backup.id)
      expect(json.key).to.equal('sqlite')
    })
  })

  describe('Task', () => {
    it('should construct with defaults', () => {
      const task = new Task()
      expect(task.id).to.be.null
      expect(task.isFailed).to.be.false
      expect(task.isFinished).to.be.false
    })

    it('should setData', () => {
      const task = new Task()
      task.setData('embed-metadata', { text: 'Embedding', key: 'task.embed' }, { text: 'Processing...' }, true, { libraryItemId: '123' })
      expect(task.id).to.be.a('string')
      expect(task.action).to.equal('embed-metadata')
      expect(task.title).to.equal('Embedding')
      expect(task.titleKey).to.equal('task.embed')
      expect(task.description).to.equal('Processing...')
      expect(task.showSuccess).to.be.true
      expect(task.data.libraryItemId).to.equal('123')
    })

    it('should setFailed', () => {
      const task = new Task()
      task.setData('test', { text: 'Test' }, null, false)
      task.setFailed({ text: 'Something went wrong', key: 'error.generic' })
      expect(task.isFailed).to.be.true
      expect(task.isFinished).to.be.true
      expect(task.error).to.equal('Something went wrong')
      expect(task.errorKey).to.equal('error.generic')
    })

    it('should setFinished with new description', () => {
      const task = new Task()
      task.setData('test', { text: 'Test' }, { text: 'Starting' }, false)
      task.setFinished({ text: 'Done!', key: 'task.done' })
      expect(task.isFinished).to.be.true
      expect(task.description).to.equal('Done!')
      expect(task.descriptionKey).to.equal('task.done')
    })

    it('should setFinished with clear description', () => {
      const task = new Task()
      task.setData('test', { text: 'Test' }, { text: 'Starting' }, false)
      task.setFinished(null, true)
      expect(task.description).to.be.null
      expect(task.descriptionKey).to.be.null
    })

    it('should serialize', () => {
      const task = new Task()
      task.setData('test', { text: 'Test' }, null, false)
      const json = task.toJSON()
      expect(json.action).to.equal('test')
      expect(json.title).to.equal('Test')
      expect(json.isFailed).to.be.false
    })
  })

  describe('PlaybackSession', () => {
    it('should construct with defaults', () => {
      const session = new PlaybackSession()
      expect(session.id).to.be.null
      expect(session.currentTime).to.equal(0)
      expect(session.startTime).to.equal(0)
    })

    it('should construct from data', () => {
      const session = new PlaybackSession({
        id: 'sess1',
        userId: 'user1',
        duration: 3600,
        currentTime: 120,
        startTime: 0,
        displayTitle: 'My Book',
        deviceInfo: { id: 'dev1', browserName: 'Chrome' }
      })
      expect(session.id).to.equal('sess1')
      expect(session.displayTitle).to.equal('My Book')
      expect(session.deviceInfo).to.not.be.null
      expect(session.deviceInfo.browserName).to.equal('Chrome')
    })

    it('should strip old-format IDs', () => {
      const session = new PlaybackSession({ libraryId: 'lib_old', libraryItemId: 'li_old' })
      expect(session.libraryId).to.be.null
      expect(session.libraryItemId).to.be.null
    })

    it('should calculate progress', () => {
      const session = new PlaybackSession({ duration: 100, currentTime: 50 })
      expect(session.progress).to.equal(0.5)
    })

    it('should calculate progress with zero duration', () => {
      const session = new PlaybackSession({ duration: 0, currentTime: 50 })
      expect(session.progress).to.equal(0)
    })

    it('should addListeningTime', () => {
      const session = new PlaybackSession({ timeListening: 10 })
      session.addListeningTime(5)
      expect(session.timeListening).to.equal(15)
      expect(session.updatedAt).to.be.a('number')
    })

    it('should not addListeningTime for NaN', () => {
      const session = new PlaybackSession({ timeListening: 10 })
      session.addListeningTime(NaN)
      expect(session.timeListening).to.equal(10)
    })

    it('should serialize with deep cloned mediaMetadata', () => {
      const metadata = { title: 'Book', authors: [{ name: 'Author' }] }
      const session = new PlaybackSession({ mediaMetadata: metadata })
      const json = session.toJSON()
      json.mediaMetadata.title = 'Changed'
      expect(session.mediaMetadata.title).to.equal('Book')
    })

    it('should toJSONForClient include audioTracks', () => {
      const session = new PlaybackSession({ id: 'sess1' })
      session.audioTracks = [{ toJSON: () => ({ index: 1 }) }]
      const json = session.toJSONForClient()
      expect(json.audioTracks).to.deep.equal([{ index: 1 }])
      expect(json.libraryItem).to.be.null
    })
  })

  describe('EmailSettings', () => {
    it('should construct with defaults', () => {
      const es = new EmailSettings()
      expect(es.id).to.equal('email-settings')
      expect(es.port).to.equal(465)
      expect(es.secure).to.be.true
      expect(es.rejectUnauthorized).to.be.true
      expect(es.ereaderDevices).to.deep.equal([])
    })

    it('should construct from data', () => {
      const es = new EmailSettings({ host: 'smtp.test.com', port: 587, secure: false })
      expect(es.host).to.equal('smtp.test.com')
      expect(es.port).to.equal(587)
      expect(es.secure).to.be.false
    })

    it('should update and detect changes', () => {
      const es = new EmailSettings({ host: 'old.com' })
      expect(es.update({ host: 'new.com' })).to.be.true
      expect(es.host).to.equal('new.com')
      expect(es.update({ host: 'new.com' })).to.be.false
    })

    it('should validate ereader devices on update', () => {
      const es = new EmailSettings()
      es.update({
        ereaderDevices: [
          { name: 'Kindle', email: 'kindle@example.com' },
          { name: '', email: '' } // invalid, should be filtered
        ]
      })
      expect(es.ereaderDevices).to.have.length(1)
      expect(es.ereaderDevices[0].name).to.equal('Kindle')
      expect(es.ereaderDevices[0].availabilityOption).to.equal('adminOrUp')
    })

    it('should get transport object', () => {
      const es = new EmailSettings({ host: 'smtp.test.com', port: 465, user: 'test', pass: 'pass123', secure: true })
      const transport = es.getTransportObject()
      expect(transport.host).to.equal('smtp.test.com')
      expect(transport.secure).to.be.true
      expect(transport.auth.user).to.equal('test')
    })

    it('should get transport object with non-465 port', () => {
      const es = new EmailSettings({ host: 'smtp.test.com', port: 587, secure: true })
      const transport = es.getTransportObject()
      expect(transport.secure).to.be.false
      expect(transport.port).to.equal(587)
    })
  })
})
