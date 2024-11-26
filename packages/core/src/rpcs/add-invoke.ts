import type {
  AddInvokeTransactionParameters,
  Call,
  RpcTypeToMessageMap,
} from "@starknet-io/types-js";

import { KakarotAdapterRpc } from "../utils/rpc.js";
import { encodeAbiParameters, toHex } from "viem";
import { hash } from "starknet";

export type WalletAddInvokeTransactionMethod = "wallet_addInvokeTransaction";
export type AddInvokeTransactionParams =
  RpcTypeToMessageMap[WalletAddInvokeTransactionMethod]["params"];
type Result = RpcTypeToMessageMap[WalletAddInvokeTransactionMethod]["result"];

const MULTICALL_CAIRO_PRECOMPILE = "0x0000000000000000000000000000000000075003";

export class WalletAddInvokeTransaction extends KakarotAdapterRpc {
  async handleRequest(params: AddInvokeTransactionParams): Promise<Result> {
    if (!params) throw new Error("Params are missing");
    const { calls } = params as AddInvokeTransactionParameters;
    const transaction_hash = await this.adapter.ethProvider!.request({
      method: "eth_sendTransaction",
      params: [
        {
          from: this.adapter.selectedAddress,
          to: MULTICALL_CAIRO_PRECOMPILE,
          data: prepareTransactionData(calls),
        },
      ],
    });
    return {
      transaction_hash: transaction_hash,
    };
  }
}

/**
 * Prepares the transaction data for a multicall targeting the Kakarot MulticallCairo precompile.
 * @param calls - The calls to prepare
 * @returns The prepared transaction data
 */
const prepareTransactionData = (calls: Call[]) => {
  const encodedCalls = calls.map((call) => {
    const encoded = encodeAbiParameters(
      [
        { type: "uint256", name: "contractAddress" },
        { type: "uint256", name: "selector" },
        { type: "uint256[]", name: "calldata" },
      ],
      [
        BigInt(call.contract_address),
        BigInt(hash.getSelectorFromName(call.entry_point)),
        (call.calldata as string[]).map((data: string) => BigInt(data)),
      ],
    );
    return encoded.slice(2); // Remove the '0x' prefix from each encoded call
  });

  const concatenatedCalls = encodedCalls.join("");
  const callCount = toHex(calls.length, { size: 32 }).slice(2); // Remove the '0x' prefix from the call count
  return `0x${callCount}${concatenatedCalls}` as `0x${string}`;
};
