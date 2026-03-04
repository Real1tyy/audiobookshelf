const { expect } = require('chai')
const { filterAndSortLibraryItems, parseFilterString, applySearchFilter, applyProgressFilter, sortLibraryItems } = require('../../../server/utils/itemFilters')

describe('itemFilters', () => {
  // Mock library items
  const mockLibraryItems = [
    {
      id: '1',
      addedAt: 1000,
      size: 1000000,
      media: {
        title: 'Harry Potter and the Sorcerer\'s Stone',
        publishedYear: 1997,
        duration: 3600,
        genres: ['Fantasy', 'Young Adult'],
        tags: ['magic', 'adventure'],
        authors: [{ id: 'author1', name: 'J.K. Rowling' }],
        publisher: 'Scholastic',
        language: 'en',
        abridged: false,
        explicit: false,
        audioFiles: [{ path: 'file1.mp3' }, { path: 'file2.mp3' }]
      }
    },
    {
      id: '2',
      addedAt: 2000,
      size: 2000000,
      media: {
        title: 'The Hobbit',
        publishedYear: 1937,
        duration: 7200,
        genres: ['Fantasy'],
        tags: ['adventure', 'classic'],
        authors: [{ id: 'author2', name: 'J.R.R. Tolkien' }],
        publisher: 'Houghton Mifflin',
        language: 'en',
        abridged: false,
        explicit: false,
        audioFiles: [{ path: 'file1.mp3' }]
      }
    },
    {
      id: '3',
      addedAt: 3000,
      size: 500000,
      media: {
        title: 'Dune',
        publishedYear: 1965,
        duration: 10800,
        genres: ['Science Fiction'],
        tags: ['space', 'politics'],
        authors: [{ id: 'author3', name: 'Frank Herbert' }],
        publisher: 'Chilton Books',
        language: 'en',
        abridged: true,
        explicit: false,
        audioFiles: []
      }
    }
  ]

  const mockUser = {
    mediaProgress: [
      { libraryItemId: '1', progress: 0.5, isFinished: false },
      { libraryItemId: '2', progress: 1.0, isFinished: true }
    ]
  }

  describe('parseFilterString', () => {
    it('should parse simple filter', () => {
      const result = parseFilterString('abridged')
      expect(result).to.deep.equal({ filterGroup: 'abridged', filterValue: 'abridged' })
    })

    it('should parse complex filter', () => {
      const encoded = Buffer.from('Fantasy').toString('base64')
      const result = parseFilterString(`genres.${encoded}`)
      expect(result.filterGroup).to.equal('genres')
      expect(result.filterValue).to.equal('Fantasy')
    })

    it('should handle "all" filter', () => {
      const result = parseFilterString('all')
      expect(result).to.deep.equal({ filterGroup: null, filterValue: null })
    })
  })

  describe('applySearchFilter', () => {
    it('should filter by search query', () => {
      const result = applySearchFilter(mockLibraryItems, 'harry')
      expect(result).to.have.lengthOf(1)
      expect(result[0].id).to.equal('1')
    })

    it('should be case insensitive', () => {
      const result = applySearchFilter(mockLibraryItems, 'HOBBIT')
      expect(result).to.have.lengthOf(1)
      expect(result[0].id).to.equal('2')
    })

    it('should return all items when no search query', () => {
      const result = applySearchFilter(mockLibraryItems, null)
      expect(result).to.have.lengthOf(3)
    })
  })

  describe('applyProgressFilter', () => {
    it('should filter by finished', () => {
      const result = applyProgressFilter(mockLibraryItems, 'finished', mockUser)
      expect(result).to.have.lengthOf(1)
      expect(result[0].id).to.equal('2')
    })

    it('should filter by in-progress', () => {
      const result = applyProgressFilter(mockLibraryItems, 'in-progress', mockUser)
      expect(result).to.have.lengthOf(1)
      expect(result[0].id).to.equal('1')
    })

    it('should filter by not-started', () => {
      const result = applyProgressFilter(mockLibraryItems, 'not-started', mockUser)
      expect(result).to.have.lengthOf(1)
      expect(result[0].id).to.equal('3')
    })
  })

  describe('sortLibraryItems', () => {
    it('should sort by title ascending', () => {
      const result = sortLibraryItems(mockLibraryItems, 'title', false)
      expect(result[0].media.title).to.equal('Dune')
      expect(result[1].media.title).to.equal('Harry Potter and the Sorcerer\'s Stone')
      expect(result[2].media.title).to.equal('The Hobbit')
    })

    it('should sort by publishedYear descending', () => {
      const result = sortLibraryItems(mockLibraryItems, 'publishedYear', true)
      expect(result[0].media.publishedYear).to.equal(1997)
      expect(result[1].media.publishedYear).to.equal(1965)
      expect(result[2].media.publishedYear).to.equal(1937)
    })

    it('should sort by size ascending', () => {
      const result = sortLibraryItems(mockLibraryItems, 'size', false)
      expect(result[0].size).to.equal(500000)
      expect(result[1].size).to.equal(1000000)
      expect(result[2].size).to.equal(2000000)
    })
  })

  describe('filterAndSortLibraryItems', () => {
    it('should filter by genre', () => {
      const encoded = Buffer.from('Fantasy').toString('base64')
      const result = filterAndSortLibraryItems(mockLibraryItems, {
        filterBy: `genres.${encoded}`
      })
      expect(result).to.have.lengthOf(2)
      expect(result.map(r => r.id)).to.include.members(['1', '2'])
    })

    it('should filter by abridged', () => {
      const result = filterAndSortLibraryItems(mockLibraryItems, {
        filterBy: 'abridged'
      })
      expect(result).to.have.lengthOf(1)
      expect(result[0].id).to.equal('3')
    })

    it('should filter by tracks', () => {
      const encoded = Buffer.from('none').toString('base64')
      const result = filterAndSortLibraryItems(mockLibraryItems, {
        filterBy: `tracks.${encoded}`
      })
      expect(result).to.have.lengthOf(1)
      expect(result[0].id).to.equal('3')
    })

    it('should combine search and filter', () => {
      const encoded = Buffer.from('Fantasy').toString('base64')
      const result = filterAndSortLibraryItems(mockLibraryItems, {
        searchQuery: 'harry',
        filterBy: `genres.${encoded}`
      })
      expect(result).to.have.lengthOf(1)
      expect(result[0].id).to.equal('1')
    })

    it('should filter and sort', () => {
      const encoded = Buffer.from('Fantasy').toString('base64')
      const result = filterAndSortLibraryItems(mockLibraryItems, {
        filterBy: `genres.${encoded}`,
        sortBy: 'publishedYear',
        sortDesc: false
      })
      expect(result).to.have.lengthOf(2)
      expect(result[0].media.publishedYear).to.equal(1937)
      expect(result[1].media.publishedYear).to.equal(1997)
    })
  })
})
