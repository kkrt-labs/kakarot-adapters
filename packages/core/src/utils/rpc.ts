import { RpcTypeToMessageMap } from "@starknet-io/types-js";
import { RpcMessage } from "@starknet-io/types-js";
import { KakarotAdapter } from "../adapter";
import { createStarkError } from "./errors";
// import { createStarkError } from './error';

export type IStarknetWalletRpc = {
  execute<Rpc extends RpcMessage["type"]>(
    params: RpcTypeToMessageMap[Rpc]["params"],
  ): Promise<RpcTypeToMessageMap[Rpc]["result"]>;
};

export abstract class KakarotAdapterRpc implements IStarknetWalletRpc {
  protected adapter: KakarotAdapter;

  constructor(adapter: KakarotAdapter) {
    this.adapter = adapter;
  }

  async execute<Rpc extends RpcMessage["type"]>(
    params?: RpcTypeToMessageMap[Rpc]["params"],
  ): Promise<RpcTypeToMessageMap[Rpc]["result"]> {
    try {
      await this.adapter.init(false);
      return await this.handleRequest(params);
    } catch (error) {
      throw createStarkError(error?.data?.walletRpcError?.code);
    }
  }

  abstract handleRequest<Rpc extends RpcMessage["type"]>(
    params: RpcTypeToMessageMap[Rpc]["params"],
  ): Promise<RpcTypeToMessageMap[Rpc]["result"]>;
}
