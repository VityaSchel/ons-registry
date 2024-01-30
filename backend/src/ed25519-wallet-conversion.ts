import base58 from 'bs58'

// https://github.com/oxen-io/oxen-core/blob/7bda65c5d2f615c317682ee82cd8251d35a60b69/src/cryptonote_config.h
// https://github.com/oxen-io/oxen-core/blob/7bda65c5d2f615c317682ee82cd8251d35a60b69/src/cryptonote_basic/cryptonote_basic_impl.cpp

interface AddressParseInfo {
  is_subaddress: boolean;
  has_payment_id: boolean;
  address: {
    m_spend_public_key: Uint8Array;
    m_view_public_key: Uint8Array;
  };
  payment_id?: Uint8Array;
}

enum NetworkType {
  MAINNET,
  TESTNET,
  DEVNET,
  FAKECHAIN,
}

interface NetworkConfig {
  NETWORK_TYPE: NetworkType;
  PUBLIC_ADDRESS_BASE58_PREFIX: number;
  PUBLIC_INTEGRATED_ADDRESS_BASE58_PREFIX: number;
  PUBLIC_SUBADDRESS_BASE58_PREFIX: number;
  // P2P_DEFAULT_PORT: number;
  // RPC_DEFAULT_PORT: number;
  // ZMQ_RPC_DEFAULT_PORT: number;
  // QNET_DEFAULT_PORT: number;
  // NETWORK_ID: string; // Assuming boost::uuids::uuid is converted to string
  // GENESIS_TX: string;
  // GENESIS_NONCE: number;
  // GOVERNANCE_REWARD_INTERVAL_IN_BLOCKS: number;
  // GOVERNANCE_WALLET_ADDRESS: [string, string];

  // UPTIME_PROOF_TOLERANCE: number; // Assuming seconds are converted to number
  // UPTIME_PROOF_STARTUP_DELAY: number;
  // UPTIME_PROOF_CHECK_INTERVAL: number;
  // UPTIME_PROOF_FREQUENCY: number;
  // UPTIME_PROOF_VALIDITY: number;

  // BATCHING_INTERVAL: number;
  // MIN_BATCH_PAYMENT_AMOUNT: number;
  // LIMIT_BATCH_OUTPUTS: number;
  // SERVICE_NODE_PAYABLE_AFTER_BLOCKS: number;

  // HARDFORK_DEREGISTRATION_GRACE_PERIOD: number;

  // STORE_LONG_TERM_STATE_INTERVAL: number;
}

const mainnetConfig: NetworkConfig = {
  NETWORK_TYPE: NetworkType.MAINNET,
  PUBLIC_ADDRESS_BASE58_PREFIX: 114,
  PUBLIC_INTEGRATED_ADDRESS_BASE58_PREFIX: 115,
  PUBLIC_SUBADDRESS_BASE58_PREFIX: 116,
}


function getConfig(nettype: NetworkType): NetworkConfig {
  switch (nettype) {
    case NetworkType.MAINNET:
      return mainnetConfig
    case NetworkType.TESTNET:
      // return testnetConfig
      throw new Error('Network types other than MAINNET are not implemented')
    case NetworkType.DEVNET:
      // return devnetConfig
      throw new Error('Network types other than MAINNET are not implemented')
    case NetworkType.FAKECHAIN:
      // return fakenetConfig
      throw new Error('Network types other than MAINNET are not implemented')
    default:
      throw new Error('Invalid network type')
  }
}


export function getAccountAddressFromStr(
  info: AddressParseInfo,
  nettype: NetworkType,
  str: string
): boolean {
  const conf = getConfig(nettype)
  const address_prefix = conf.PUBLIC_ADDRESS_BASE58_PREFIX
  const integrated_address_prefix = conf.PUBLIC_INTEGRATED_ADDRESS_BASE58_PREFIX
  const subaddress_prefix = conf.PUBLIC_SUBADDRESS_BASE58_PREFIX

  let data: string
  const prefix = 0
  const decoded = base58.decode(str)
  // if (!) {
  //   return false
  // }

  if (integrated_address_prefix === prefix) {
    info.is_subaddress = false
    info.has_payment_id = true
  } else if (address_prefix === prefix) {
    info.is_subaddress = false
    info.has_payment_id = false
  } else if (subaddress_prefix === prefix) {
    info.is_subaddress = true
    info.has_payment_id = false
  } else {
    throw new Error(
      `Wrong address prefix: ${prefix}, expected ${address_prefix} or ${integrated_address_prefix} or ${subaddress_prefix}`
    )
    return false
  }

  try {
    // if (info.has_payment_id) {
    //   const iadr: IntegratedAddress = serialization.parseBinary(data)
    //   info.address = iadr.adr
    //   info.payment_id = iadr.payment_id
    // } else {
    //   info.address = serialization.parseBinary(data)
    // }
  } catch (e) {
    throw new Error(`Account public address keys can't be parsed: ${e}`)
    return false
  }

  return true
}
