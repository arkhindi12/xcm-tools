import type { TAmount } from '@paraspell/assets'

import type { PolkadotApi } from '../../api'
import { NumberFormatError } from '../../errors'
import { isConfig } from '..'
import { parseUnits } from '../unit'

export const abstractDecimals = <TApi, TRes, TSigner, TCustomChain extends string = never>(
  amount: TAmount,
  decimals: number | undefined,
  api: PolkadotApi<TApi, TRes, TSigner, TCustomChain>
): bigint => {
  const { config } = api
  const abstractDecimals = !(isConfig(config) && config.abstractDecimals === false)

  return applyDecimalAbstraction(amount, decimals, abstractDecimals)
}

/**
 * Counts the fractional digits that carry information, so that trailing zeros
 * are not mistaken for excess precision. `1.500` at 2 decimals is exactly
 * representable and must not be rejected.
 */
const significantFractionDigits = (strAmount: string): string => {
  const dotIndex = strAmount.indexOf('.')
  if (dotIndex === -1) {
    return ''
  }

  return strAmount.slice(dotIndex + 1).replace(/0+$/, '')
}

export const applyDecimalAbstraction = (
  amount: TAmount,
  decimals: number | undefined,
  shouldAbstract: boolean
): bigint => {
  // If amount is already bigint, return as-is
  if (typeof amount === 'bigint') {
    return amount
  }

  if (!shouldAbstract) {
    const strAmount = amount.toString()
    if (strAmount.includes('.')) {
      throw new NumberFormatError(`Non-abstracted amount cannot have decimals: ${strAmount}`)
    }
    return BigInt(strAmount)
  }

  if (decimals === undefined) {
    const strAmount = amount.toString()
    if (strAmount.includes('.')) {
      // Return integer part only as fallback
      return BigInt(strAmount.split('.')[0])
    }
    return BigInt(strAmount)
  }

  // parseUnits (viem) rounds excess fractional digits to the nearest
  // representable value instead of rejecting them, so an amount the asset
  // cannot represent exactly would silently reach the chain as a different
  // amount. Reject it here, matching the contract the non-abstracted branch
  // above already enforces for fractional input.
  const strAmount = amount.toString()
  const fraction = significantFractionDigits(strAmount)
  if (fraction.length > decimals) {
    throw new NumberFormatError(
      `Amount ${strAmount} has more precision than the asset supports: ` +
        `${decimals} decimal${decimals === 1 ? '' : 's'}. ` +
        'The amount cannot be represented exactly and would be rounded.'
    )
  }

  return parseUnits(strAmount, decimals)
}
