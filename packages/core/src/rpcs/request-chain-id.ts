import type { RpcTypeToMessageMap } from "@starknet-io/types-js";
import { KakarotAdapterRpc } from "../utils/rpc";

export type WalletRequestChainIdMethod = "wallet_requestChainId";
type Result = RpcTypeToMessageMap[WalletRequestChainIdMethod]["result"];

export class WalletRequestChainId extends KakarotAdapterRpc {
  async handleRequest(): Promise<Result> {
    return this.adapter.chainId;
  }
}
