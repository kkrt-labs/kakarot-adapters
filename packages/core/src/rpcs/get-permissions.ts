import { Permission, RpcTypeToMessageMap } from "@starknet-io/types-js";
import { IStarknetWalletRpc, KakarotAdapterRpc } from "../utils/rpc";
import { createStarkError } from "../utils/errors";
import { getAddress } from "viem";

export type WalletGetPermissionsMethod = "wallet_getPermissions";
type Result = RpcTypeToMessageMap[WalletGetPermissionsMethod]["result"];

export class WalletGetPermissions extends KakarotAdapterRpc {
  async handleRequest(): Promise<Result> {
    const provider = this.adapter.ethProvider!;
    const permissions = await provider.request({
      method: "wallet_getPermissions",
    });
    let accounts = (permissions[0]?.caveats?.[0]?.value as string[])?.map((x) =>
      getAddress(x),
    );
    if (accounts.length != 0) {
      return [Permission.ACCOUNTS];
    }
    return [];
    //   // `'wallet_requestPermissions'` can return a different order of accounts than `'eth_accounts'`
    //   // switch to `'eth_accounts'` ordering if more than one account is connected
    //   // https://github.com/wevm/wagmi/issues/4140
    //   if (accounts.length > 0) {
    //     const sortedAccounts = await this.getAccounts()
    //     accounts = sortedAccounts
    //   }
    //   return accounts
  }
}
