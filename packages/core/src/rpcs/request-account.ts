import type { RpcTypeToMessageMap } from "@starknet-io/types-js";

import { KakarotAdapterRpc } from "../utils/rpc";

export type WalletRequestAccountMethod = "wallet_requestAccounts";
type Result = RpcTypeToMessageMap[WalletRequestAccountMethod]["result"];

export class WalletRequestAccount extends KakarotAdapterRpc {
  async handleRequest(): Promise<Result> {
    return [this.adapter.selectedAddress];
  }
}
