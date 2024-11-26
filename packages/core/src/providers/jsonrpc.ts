import type { Chain } from "../chains/types";
import { constants, RpcProvider, type RpcProviderOptions } from "starknet";

import type { ChainProviderFactory } from "./factory";
import { mainnet, sepolia } from "../chains/starknet";

/** Arguments for `jsonRpcProvider`. */
export type JsonRpcProviderArgs = {
  rpc: (chain: Chain) => RpcProviderOptions | null;
};

/** Configure the JSON-RPC provider using the provided function. */
export function jsonRpcProvider({
  rpc,
}: JsonRpcProviderArgs): ChainProviderFactory<RpcProvider> {
  return (chain) => {
    const config = rpc(chain);
    if (!config) return null;
    const chainId = starknetChainId(chain.id);

    const provider = new RpcProvider({ ...config, chainId });
    return provider;
  };
}

export function starknetChainId(
  chainId: bigint,
): constants.StarknetChainId | undefined {
  switch (chainId) {
    case mainnet.id:
      return constants.StarknetChainId.SN_MAIN;
    case sepolia.id:
      return constants.StarknetChainId.SN_SEPOLIA;
    default:
      return undefined;
  }
}
