import { detectColumnMapping, parseCsvBuffer, canonicalizeRow } from '@/features/screener/validation'

describe('detectColumnMapping', () => {
  it('maps exact canonical header names', () => {
    const headers = ['symbol', 'price', 'rsi14', 'ema20', 'ema50']
    const { resolved, missing, ambiguous } = detectColumnMapping(headers)

    expect(resolved.symbol).toBe('symbol')
    expect(resolved.price).toBe('price')
    expect(resolved.rsi14).toBe('rsi14')
    expect(missing).toHaveLength(0)
  })

  it('maps TradingView-style column aliases', () => {
    const headers = ['Ticker', 'Last', 'RSI(14)', 'EMA(20)', 'EMA(50)', 'SMA(50)']
    const { resolved, missing } = detectColumnMapping(headers)

    expect(resolved.symbol).toBe('Ticker')
    expect(resolved.price).toBe('Last')
    expect(resolved.rsi14).toBe('RSI(14)')
    expect(resolved.ema20).toBe('EMA(20)')
    expect(resolved.ema50).toBe('EMA(50)')
    expect(resolved.sma50).toBe('SMA(50)')
    expect(missing).toHaveLength(0)
  })

  it('maps "Close" and "Volume 1D" style headers', () => {
    const headers = ['Symbol', 'Close', 'Volume 1D', 'Relative Volume 1D']
    const { resolved } = detectColumnMapping(headers)

    expect(resolved.symbol).toBe('Symbol')
    expect(resolved.price).toBe('Close')
    expect(resolved.volume).toBe('Volume 1D')
    expect(resolved.relativeVolume).toBe('Relative Volume 1D')
  })

  it('identifies missing required fields', () => {
    const headers = ['some_column', 'another_column']
    const { missing } = detectColumnMapping(headers)

    expect(missing).toContain('symbol')
    expect(missing).toContain('price')
  })

  it('is case-insensitive', () => {
    const headers = ['SYMBOL', 'PRICE']
    const { resolved, missing } = detectColumnMapping(headers)

    expect(resolved.symbol).toBe('SYMBOL')
    expect(resolved.price).toBe('PRICE')
    expect(missing).toHaveLength(0)
  })

  it('trims whitespace from headers', () => {
    const headers = ['  symbol  ', '  price  ']
    const { missing } = detectColumnMapping(headers)
    expect(missing).toHaveLength(0)
  })

  it('marks ambiguous when multiple headers match a field', () => {
    const headers = ['symbol', 'price', 'ticker']  // both 'symbol' and 'ticker' map to symbol
    const { ambiguous } = detectColumnMapping(headers)
    expect(ambiguous).toContain('symbol')
  })
})

describe('parseCsvBuffer', () => {
  function csv(content: string) {
    return Buffer.from(content, 'utf-8')
  }

  it('parses a valid CSV with headers', () => {
    const buf = csv('symbol,price,rsi14\nAAPL,189.5,55.2\nMSFT,420.0,60.1')
    const result = parseCsvBuffer(buf)

    expect(result.error).toBeUndefined()
    expect(result.headers).toEqual(['symbol', 'price', 'rsi14'])
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0].symbol).toBe('AAPL')
  })

  it('handles CSV with BOM', () => {
    const buf = Buffer.concat([
      Buffer.from([0xEF, 0xBB, 0xBF]),  // UTF-8 BOM
      Buffer.from('symbol,price\nAAPL,100'),
    ])
    const result = parseCsvBuffer(buf)
    expect(result.error).toBeUndefined()
    expect(result.rows).toHaveLength(1)
  })

  it('returns error for empty content', () => {
    const result = parseCsvBuffer(csv(''))
    expect(result.error).toBeDefined()
  })

  it('trims whitespace in cell values', () => {
    const buf = csv('symbol , price\n  AAPL , 189.5 ')
    const result = parseCsvBuffer(buf)
    expect(result.rows[0]['symbol ']).toBeUndefined()
  })
})

describe('canonicalizeRow', () => {
  const mapping = {
    symbol: 'Ticker', price: 'Price', rsi14: 'RSI',
    ema20: 'EMA20', ema50: 'EMA50',
  }

  it('canonicalizes a complete valid row', () => {
    const raw = { Ticker: 'AAPL', Price: '189.50', RSI: '55.2', EMA20: '192.0', EMA50: '185.0' }
    const { row, error } = canonicalizeRow(raw, mapping, 2)

    expect(error).toBeUndefined()
    expect(row?.symbol).toBe('AAPL')
    expect(row?.price).toBeCloseTo(189.5)
    expect(row?.rsi14).toBeCloseTo(55.2)
  })

  it('uppercases the symbol', () => {
    const raw = { Ticker: 'aapl', Price: '100' }
    const { row } = canonicalizeRow(raw, mapping, 2)
    expect(row?.symbol).toBe('AAPL')
  })

  it('returns error when symbol is missing', () => {
    const raw = { Ticker: '', Price: '100' }
    const { row, error } = canonicalizeRow(raw, mapping, 2)
    expect(row).toBeUndefined()
    expect(error?.reason).toContain('Missing symbol')
  })

  it('returns error when price is not a valid number', () => {
    const raw = { Ticker: 'AAPL', Price: 'N/A' }
    const { row, error } = canonicalizeRow(raw, mapping, 3)
    expect(row).toBeUndefined()
    expect(error?.reason).toContain('Invalid price')
    expect(error?.row).toBe(3)
  })

  it('handles N/A, dash, and null strings as undefined', () => {
    const raw = { Ticker: 'AAPL', Price: '100', RSI: 'N/A', EMA20: '-', EMA50: 'null' }
    const { row } = canonicalizeRow(raw, mapping, 2)
    expect(row?.rsi14).toBeUndefined()
    expect(row?.ema20).toBeUndefined()
    expect(row?.ema50).toBeUndefined()
  })

  it('strips % suffix from percentage fields', () => {
    const mappingWithChg = { ...mapping, chg1w: 'Change1W' }
    const raw = { Ticker: 'AAPL', Price: '100', Change1W: '5.25%' }
    const { row } = canonicalizeRow(raw, mappingWithChg, 2)
    expect(row?.chg1w).toBeCloseTo(5.25)
  })

  it('includes row number in error output', () => {
    const raw = { Ticker: 'AAPL', Price: 'bad' }
    const { error } = canonicalizeRow(raw, mapping, 42)
    expect(error?.row).toBe(42)
  })
})
