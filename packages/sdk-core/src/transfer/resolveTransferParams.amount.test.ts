import type { TAssetInfo } from '@paraspell/assets'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PolkadotApi } from '../api'
import { MIN_AMOUNT } from '../constants'
import { NumberFormatError } from '../errors'
import type { TSubstrateTransferOptions } from '../types'
import { resolveTransferParams } from './createTransfer'
import { resolveAsset } from './utils'

vi.mock('../utils/chain')
vi.mock('../chains/getChainInstance')

// resolveAsset is the only collaborator this test needs; every other helper in
// ./utils is left real so the amount path is exercised unmocked.
vi.mock('./utils', async importActual => ({
  ...(await importActual()),
  resolveAsset: vi.fn()
}))

type TestApi = PolkadotApi<unknown, unknown, unknown>

describe('resolveTransferParams amount precision', () => {
  // Only the members this path touches are stubbed; the amount conversion
  // itself runs for real.
  const api = {
    config: {},
    getRelayChainSymbol: () => 'DOT',
    getAssetDecimals: () => 0,
    getFeeAssetLocation: () => undefined,
    getParaId: () => 1000,
    getParaImplementation: () => undefined,
    isChainEvm: () => false,
    getNativeAssetSymbol: () => 'DOT',
    getAssetInfo: () => undefined,
    getChain: () => undefined,
    validateSubstrateAddress: () => true,
    findAssetInfoOnDest: () => ({ symbol: 'DED', decimals: 0 })
  } as unknown as TestApi

  const origin = 'AssetHubPolkadot'
  const destination = 'Acala'

  const buildOptions = (amount: string): TSubstrateTransferOptions<unknown, unknown, unknown> =>
    ({
      api,
      from: origin,
      to: destination,
      recipient: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
      currency: { amount }
    }) as TSubstrateTransferOptions<unknown, unknown, unknown>

  const assetWith = (decimals: number): TAssetInfo =>
    ({ symbol: 'DED', decimals, assetId: '85' }) as TAssetInfo

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects a sub-unit amount on a zero-decimals asset instead of clamping it to 2 tokens', () => {
    // Before the fix this rounded to 0n and the MIN_AMOUNT clamp then raised it
    // to 2 whole tokens for a 0.4 request.
    vi.mocked(resolveAsset).mockReturnValue(assetWith(0))

    expect(() => resolveTransferParams(buildOptions('0.4'))).toThrow(NumberFormatError)
    expect(MIN_AMOUNT).toBe(2n)
  })

  it('rejects an over-precision amount instead of rounding it up', () => {
    vi.mocked(resolveAsset).mockReturnValue(assetWith(6))

    expect(() => resolveTransferParams(buildOptions('1.9999999'))).toThrow(NumberFormatError)
  })

  it('still clamps an exact sub-MIN_AMOUNT result, which is unrelated to rounding', () => {
    // 0.000001 at 6 decimals is exactly 1n: representable, below MIN_AMOUNT,
    // and therefore legitimately clamped. Precision validation must not
    // interfere with this path.
    vi.mocked(resolveAsset).mockReturnValue(assetWith(6))

    const result = resolveTransferParams(buildOptions('0.000001'))

    expect(result.normalizedAsset.amount).toBe(MIN_AMOUNT)
  })

  it('leaves an exactly representable amount unchanged', () => {
    vi.mocked(resolveAsset).mockReturnValue(assetWith(6))

    const result = resolveTransferParams(buildOptions('1.5'))

    expect(result.normalizedAsset.amount).toBe(1500000n)
  })

  it('leaves a whole amount on a zero-decimals asset unchanged', () => {
    vi.mocked(resolveAsset).mockReturnValue(assetWith(0))

    const result = resolveTransferParams(buildOptions('3'))

    expect(result.normalizedAsset.amount).toBe(3n)
  })
})
