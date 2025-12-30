import { normalizeCountry } from './discogs'

/** Coverage for the normalization helper to ensure bucket mapping stays stable. */
describe('normalizeCountry', () => {
  it('should return Unknown for empty/null inputs', () => {
    expect(normalizeCountry(null)).toBe('Unknown')
    expect(normalizeCountry(undefined)).toBe('Unknown')
    expect(normalizeCountry('')).toBe('Unknown')
    expect(normalizeCountry('   ')).toBe('Unknown')
  })

  it('should map UK variants to GB', () => {
    expect(normalizeCountry('UK')).toBe('GB')
    expect(normalizeCountry('U.K.')).toBe('GB')
    expect(normalizeCountry('United Kingdom')).toBe('GB')
  })

  it('should map US variants to US', () => {
    expect(normalizeCountry('USA')).toBe('US')
    expect(normalizeCountry('U.S.A.')).toBe('US')
    expect(normalizeCountry('United States')).toBe('US')
  })

  it('should map Europe and Worldwide to Unmapped', () => {
    expect(normalizeCountry('Europe')).toBe('Unmapped')
    expect(normalizeCountry('Worldwide')).toBe('Unmapped')
  })

  it('should return the trimmed input for unknown countries', () => {
    expect(normalizeCountry('Germany')).toBe('Germany')
    expect(normalizeCountry(' Japan ')).toBe('Japan')
  })
})
