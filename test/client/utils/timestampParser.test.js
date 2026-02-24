const chai = require('chai')
const expect = chai.expect
const { parseTimestampWithKeywords } = require('../../../client/utils/timestampParser')

describe('parseTimestampWithKeywords', () => {
  const defaults = { totalDuration: 600, currentTime: 120 }

  describe('plain timestamps', () => {
    it('parses plain seconds', () => {
      expect(parseTimestampWithKeywords('90', defaults)).to.equal(90)
    })

    it('parses decimal seconds', () => {
      expect(parseTimestampWithKeywords('3.5', defaults)).to.equal(3.5)
    })

    it('parses MM:SS', () => {
      expect(parseTimestampWithKeywords('2:30', defaults)).to.equal(150)
    })

    it('parses H:MM:SS', () => {
      expect(parseTimestampWithKeywords('1:02:30', defaults)).to.equal(3750)
    })

    it('parses 0:00', () => {
      expect(parseTimestampWithKeywords('0:00', defaults)).to.equal(0)
    })

    it('returns NaN for empty string', () => {
      expect(parseTimestampWithKeywords('', defaults)).to.be.NaN
    })

    it('returns NaN for non-string input', () => {
      expect(parseTimestampWithKeywords(null, defaults)).to.be.NaN
      expect(parseTimestampWithKeywords(undefined, defaults)).to.be.NaN
      expect(parseTimestampWithKeywords(123, defaults)).to.be.NaN
    })

    it('returns NaN for garbage text', () => {
      expect(parseTimestampWithKeywords('abc', defaults)).to.be.NaN
      expect(parseTimestampWithKeywords('1:2:3:4', defaults)).to.be.NaN
    })
  })

  describe('keyword: start', () => {
    it('returns 0 for "start"', () => {
      expect(parseTimestampWithKeywords('start', defaults)).to.equal(0)
    })

    it('handles "Start" (case insensitive)', () => {
      expect(parseTimestampWithKeywords('Start', defaults)).to.equal(0)
    })

    it('handles "  start  " (whitespace)', () => {
      expect(parseTimestampWithKeywords('  start  ', defaults)).to.equal(0)
    })

    it('handles "start + 5"', () => {
      expect(parseTimestampWithKeywords('start + 5', defaults)).to.equal(5)
    })

    it('handles "start - 5"', () => {
      expect(parseTimestampWithKeywords('start - 5', defaults)).to.equal(-5)
    })

    it('handles "start+10" (no spaces)', () => {
      expect(parseTimestampWithKeywords('start+10', defaults)).to.equal(10)
    })

    it('handles "start + 30.5" (decimal offset)', () => {
      expect(parseTimestampWithKeywords('start + 30.5', defaults)).to.equal(30.5)
    })
  })

  describe('keyword: end', () => {
    it('returns totalDuration for "end"', () => {
      expect(parseTimestampWithKeywords('end', defaults)).to.equal(600)
    })

    it('handles "end - 10"', () => {
      expect(parseTimestampWithKeywords('end - 10', defaults)).to.equal(590)
    })

    it('handles "end + 5"', () => {
      expect(parseTimestampWithKeywords('end + 5', defaults)).to.equal(605)
    })

    it('handles "END - 30" (case insensitive)', () => {
      expect(parseTimestampWithKeywords('END - 30', defaults)).to.equal(570)
    })

    it('handles "end-60" (no spaces)', () => {
      expect(parseTimestampWithKeywords('end-60', defaults)).to.equal(540)
    })
  })

  describe('keyword: now', () => {
    it('returns currentTime for "now"', () => {
      expect(parseTimestampWithKeywords('now', defaults)).to.equal(120)
    })

    it('handles "now + 30"', () => {
      expect(parseTimestampWithKeywords('now + 30', defaults)).to.equal(150)
    })

    it('handles "now - 10"', () => {
      expect(parseTimestampWithKeywords('now - 10', defaults)).to.equal(110)
    })

    it('handles "now+5" (no spaces)', () => {
      expect(parseTimestampWithKeywords('now+5', defaults)).to.equal(125)
    })

    it('handles "NOW - 50" (case insensitive)', () => {
      expect(parseTimestampWithKeywords('NOW - 50', defaults)).to.equal(70)
    })

    it('handles "now + 0.5" (decimal offset)', () => {
      expect(parseTimestampWithKeywords('now + 0.5', defaults)).to.equal(120.5)
    })

    it('defaults currentTime to 0 when not provided', () => {
      expect(parseTimestampWithKeywords('now', { totalDuration: 600 })).to.equal(0)
      expect(parseTimestampWithKeywords('now + 10', { totalDuration: 600 })).to.equal(10)
    })
  })

  describe('invalid keyword arithmetic', () => {
    it('returns NaN for "start + abc"', () => {
      expect(parseTimestampWithKeywords('start + abc', defaults)).to.be.NaN
    })

    it('returns NaN for "end * 2"', () => {
      expect(parseTimestampWithKeywords('end * 2', defaults)).to.be.NaN
    })

    it('returns NaN for "now + + 5"', () => {
      expect(parseTimestampWithKeywords('now + + 5', defaults)).to.be.NaN
    })

    it('returns NaN for "now 5"', () => {
      expect(parseTimestampWithKeywords('now 5', defaults)).to.be.NaN
    })

    it('returns NaN for "starting"', () => {
      expect(parseTimestampWithKeywords('starting', defaults)).to.be.NaN
    })

    it('returns NaN for "ending"', () => {
      expect(parseTimestampWithKeywords('ending', defaults)).to.be.NaN
    })

    it('returns NaN for "nowhere"', () => {
      expect(parseTimestampWithKeywords('nowhere', defaults)).to.be.NaN
    })
  })
})
