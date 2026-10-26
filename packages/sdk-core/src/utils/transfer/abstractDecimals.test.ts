import { beforeEach, describe, expect, it, vi } from 'vitest'

import { NumberFormatError } from '../../errors'
import { applyDecimalAbstraction } from './abstractDecimals'

// parseUnits comes from viem, which rounds excess fractional digits instead of
// rejecting them (ethers throws). Mocking it here would hide exactly the
// behaviour under test, so the real implementation is used throughout.

describe('applyDecimalAbstraction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('bigint and non-abstracted input', () => {
    it('returns a bigint amount unchanged', () => {
      expect(applyDecimalAbstraction(1234n, 0, true)).toBe(1234n)
    })

    it('returns a bigint amount unchanged when abstraction is disabled', () => {
      expect(applyDecimalAbstraction(1234n, 0, false)).toBe(1234n)
    })

    it('accepts an integer amount when abstraction is disabled', () => {
      expect(applyDecimalAbstraction(42, 0, false)).toBe(42n)
    })

    it('rejects a fractional amount when abstraction is disabled', () => {
      expect(() => applyDecimalAbstraction('1.5', 0, false)).toThrow(NumberFormatError)
    })
  })

  describe('undefined decimals', () => {
    it('accepts an integer amount', () => {
      expect(applyDecimalAbstraction('42', undefined, true)).toBe(42n)
    })

    // The fractional case in this branch is issue #2235 and is fixed
    // separately; this change deliberately leaves that branch untouched.
  })

  describe('defined decimals, representable amounts', () => {
    it('scales a whole number', () => {
      expect(applyDecimalAbstraction('3', 0, true)).toBe(3n)
    })

    it('scales a fractional amount with exactly the supported precision', () => {
      expect(applyDecimalAbstraction('1.5', 6, true)).toBe(1500000n)
    })

    it('scales an amount that fills the precision exactly', () => {
      expect(applyDecimalAbstraction('1.999999', 6, true)).toBe(1999999n)
    })

    it('accepts a numeric input', () => {
      expect(applyDecimalAbstraction(2.5, 1, true)).toBe(25n)
    })

    it('ignores trailing zeros beyond the supported precision', () => {
      expect(applyDecimalAbstraction('1.500000000', 2, true)).toBe(150n)
    })
  })

  describe('defined decimals, over-precision amounts', () => {
    // Each of these used to be silently rounded by viem's parseUnits, so the
    // signed transaction carried an amount the caller never asked for.
    it('rejects an amount that would round up past the specified value', () => {
      expect(() => applyDecimalAbstraction('1.9999999', 6, true)).toThrow(NumberFormatError)
    })

    it('rejects a fraction on a zero-decimals asset instead of rounding to 2', () => {
      expect(() => applyDecimalAbstraction('1.5', 0, true)).toThrow(NumberFormatError)
    })

    it('rejects a sub-unit amount on a zero-decimals asset instead of rounding to 0', () => {
      expect(() => applyDecimalAbstraction('0.4', 0, true)).toThrow(NumberFormatError)
    })

    it('rejects a sub-unit amount on a two-decimals asset', () => {
      expect(() => applyDecimalAbstraction('0.005', 2, true)).toThrow(NumberFormatError)
    })

    it('names the amount and the supported precision in the error', () => {
      expect(() => applyDecimalAbstraction('1.234', 2, true)).toThrow(/1\.234.*2 decimal/)
    })
  })
})
