export const ARC_TESTNET = {
  chainId: 5042002,
  chainIdHex: '0x4CA452',
  name: 'Arc Testnet',
  rpcUrl: 'https://rpc.testnet.arc.network',
  wsUrl: 'wss://rpc.testnet.arc.network',
  explorerUrl: 'https://testnet.arcscan.app',
  faucetUrl: 'https://faucet.circle.com',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 }
} as const

// Source fetched before implementation:
// https://docs.arc.io/arc/references/contract-addresses
export const ARC_CONTRACTS = {
  // USDC is native gas plus an optional ERC-20 interface. ERC-20 uses 6 decimals.
  USDC: '0x3600000000000000000000000000000000000000',
  EURC: '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a',
  USYC: '0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C',
  CCTP_TOKEN_MESSENGER: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
  CCTP_MESSAGE_TRANSMITTER: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
  CCTP_TOKEN_MINTER: '0xb43db544E2c27092c107639Ad201b3dEfAbcF192',
  CCTP_MESSAGE: '0xbaC0179bB358A8936169a63408C8481D582390C4',
  CCTP_ARC_DOMAIN: 26,
  GATEWAY: '0x0077777d7EBA4688BDeF3E311b846F25870A19B9',
  GATEWAY_MINTER: '0x0022222ABE238Cc2C7Bb1f21003F0a260052475B',
  MULTICALL3: '0xcA11bde05977b3631167028862bE2a173976CA11',
  PERMIT2: '0x000000000022D473030F116dDEE9F6B43aC78BA3'
} as const

export const USDC_ERC20_DECIMALS = 6
export const USDC_NATIVE_DECIMALS = 18
