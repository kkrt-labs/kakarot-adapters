import type { RpcTypeToMessageMap } from "@starknet-io/types-js";
import { KakarotAdapterRpc } from "../utils/rpc.js";
import { createStarkError } from "../utils/errors.js";
import {
  getCorrespondingKakarotChain,
  ProviderNotFoundError,
} from "../adapter.js";
import { numberToHex } from "viem";

export type WalletSwitchStarknetChainMethod = "wallet_switchStarknetChain";
type Params = RpcTypeToMessageMap[WalletSwitchStarknetChainMethod]["params"];
type Result = RpcTypeToMessageMap[WalletSwitchStarknetChainMethod]["result"];

export class WalletSwitchStarknetChain extends KakarotAdapterRpc {
  async execute(params: Params): Promise<Result> {
    // Adding a lock can make sure the switching network process can only process once at a time with get-starknet,
    // For cross dapp switching network, which already handle by the snap,
    // Example scenario:
    // [Rq1] wallet init and send switch network B request to snap at T0
    // [Rq2] wallet init and send switch network B request to snap at T1 <-- this request will be on hold by the lock
    // [Rq1] confrim request and network switch to B, assign local chain Id to B at T2
    // [Rq2] lock release, wallet inited and local chainId is B, which is same as request, so we return true directly at T3
    try {
      return await this.adapter.lock.runExclusive(async () => {
        await this.adapter.init(false);
        return this.handleRequest(params);
      });
    } catch (error) {
      throw createStarkError(error?.data?.walletRpcError?.code);
    }
  }

  async handleRequest(param: Params): Promise<Result> {
    if (!this.adapter.ethProvider) throw new ProviderNotFoundError();

    const { chainId: starknetChainId } = param;

    const kakarotChainId = getCorrespondingKakarotChain(
      Number(starknetChainId),
    )?.id;
    if (!kakarotChainId) {
      throw new Error(`Unsupported chain id: ${starknetChainId}`);
    }

    await this.adapter.ethProvider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: numberToHex(kakarotChainId) }],
    });
    // after switching the network,
    // we need to re-init the wallet object to assign the latest chainId into it
    await this.adapter.init(false);

    // This request either throws or returns true
    return true;
  }
}
