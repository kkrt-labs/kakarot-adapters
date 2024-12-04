import {
  AddInvokeTransactionParameters,
  Call,
  Permission,
  RpcMessage,
  RpcTypeToMessageMap,
  StarknetWindowObject,
  SwitchStarknetChainParameters,
  WalletEventHandlers,
} from "@starknet-io/types-js";
import { MutexInterface } from "async-mutex";
import { EIP1193Provider } from "mipd";
import {
  Account,
  AccountInterface,
  constants,
  hash,
  ProviderInterface,
  ProviderOptions,
} from "starknet";
import {
  Chain as KakarotChain,
  TypedData,
  defineChain,
  encodeAbiParameters,
  getAddress,
  numberToHex,
  toHex,
} from "viem";
import { WalletGetPermissions } from "./rpcs/get-permissions";
import { WalletRequestAccount } from "./rpcs/request-account";
import { WalletSwitchStarknetChain } from "./rpcs/switch-network";
import { WalletRequestChainId } from "./rpcs/request-chain-id";
import { WalletAddInvokeTransaction } from "./rpcs/add-invoke";
import { WalletRpcError, WalletRpcErrorCode } from "./utils/errors";
import { CHAIN_CONFIGS, DEFAULT_CHAIN } from "./chains/chains";
import { publicProvider } from "./providers/public";
import { Chain as StarknetChain } from "./chains/types";

const MULTICALL_CAIRO_PRECOMPILE = "0x0000000000000000000000000000000000075003";

export interface KakarotWalletDetails {
  id: string;
  name: string;
  icon: StarknetWindowObject["icon"];
}

export type IStarknetWalletRpc = {
  execute<Rpc extends RpcMessage["type"]>(
    params: RpcTypeToMessageMap[Rpc]["params"],
  ): Promise<RpcTypeToMessageMap[Rpc]["result"]>;
};

export enum RpcMethod {
  WalletSwitchStarknetChain = "wallet_switchStarknetChain",
  WalletSupportedSpecs = "wallet_supportedSpecs",
  WalletDeploymentData = "wallet_deploymentData",
  WalletSupportedWalletApi = "wallet_supportedWalletApi",
  WalletRequestAccounts = "wallet_requestAccounts",
  WalletRequestChainId = "wallet_requestChainId",
  WalletAddInvokeTransaction = "wallet_addInvokeTransaction",
  WalletAddDeclareTransaction = "wallet_addDeclareTransaction",
  WalletWatchAsset = "wallet_watchAsset",
  WalletSignTypedData = "wallet_signTypedData",
  WalletGetPermissions = "wallet_getPermissions",
}

export class KakarotAdapter implements StarknetWindowObject {
  id: string;
  name: string;
  icon: StarknetWindowObject["icon"];
  version: string = "1.0.0";
  isConnected: boolean;

  #rpcHandlers: Map<string, IStarknetWalletRpc>;
  #account: AccountInterface | undefined;
  #selectedAddress: `0x${string}`;

  // The active Starknet Chain ID
  #starknetNetwork: StarknetChain | undefined;
  #starknetProvider: ProviderInterface | undefined;
  #chainId: bigint;

  // The active Kakarot Chain ID
  #ethProvider: EIP1193Provider;
  #kakarotChainId: string;

  lock: MutexInterface;

  //TODO: doc
  /**
   * Initializes a new instance of the KakarotAdapter class.
   *
   * @param provider - The EIP1193-Compatible Wallet Provider.
   * @param details - The Kakarot Wallet Details.
   * @param metamaskProvider - The MetaMask Wallet Provider.
   * @param _snapVersion - The `_snapVersion` parameter remains to maintain compatibility with existing usage.
   */
  constructor(provider: EIP1193Provider, details: KakarotWalletDetails) {
    this.id = details.id;
    this.name = details.name;
    this.icon = details.icon;
    this.#ethProvider = provider;

    this.#rpcHandlers = new Map<string, IStarknetWalletRpc>([
      [
        RpcMethod.WalletSwitchStarknetChain,
        new WalletSwitchStarknetChain(this),
      ],
      [RpcMethod.WalletRequestAccounts, new WalletRequestAccount(this)],
      [RpcMethod.WalletRequestChainId, new WalletRequestChainId(this)],
      [
        RpcMethod.WalletAddInvokeTransaction,
        new WalletAddInvokeTransaction(this),
      ],
      [RpcMethod.WalletGetPermissions, new WalletGetPermissions(this)],
    ]);
  }

  /**
   * Execute the Wallet RPC request.
   * It will call the corresponding RPC handler based on the request type.
   *
   * @param call - The RPC request object.
   * @returns The corresponding RPC response.
   */
  async request<Data extends RpcMessage>(
    call: Omit<Data, "result">,
  ): Promise<Data["result"]> {
    const { type, params } = call;

    const handler = this.#rpcHandlers.get(type);

    if (handler !== undefined) {
      return await handler.execute(params);
    }

    throw new WalletRpcError(
      `Method not supported`,
      WalletRpcErrorCode.Unknown,
    );
  }

  async #getWalletAddress() {
    const address = (await this.getAccounts())[0];

    if (!address) {
      throw new Error("Unable to recover accounts");
    }

    return address;
  }

  /// Required by spec, but can't be implemented
  get account() {
    if (!this.#account) {
      if (!this.selectedAddress) {
        throw new Error("Address is not set");
      }

      this.#account = new Account(
        this.starknetProvider,
        "",
        this.selectedAddress,
      );
    }
    return this.#account;
  }

  get ethProvider(): EIP1193Provider {
    return this.#ethProvider;
  }

  get starknetProvider(): ProviderInterface {
    if (!this.#starknetProvider) {
      if (!this.#starknetNetwork) {
        throw new Error("Network is not set");
      }

      const starknetProvider = publicProvider()!(this.#starknetNetwork);
      if (!starknetProvider) {
        throw new Error("Unable to find the selected network");
      }
      this.#starknetProvider = starknetProvider;
    }
    return this.#starknetProvider;
  }

  get selectedAddress(): `0x${string}` {
    return this.#selectedAddress;
  }

  async getAccounts(): Promise<`0x${string}`[]> {
    if (!this.ethProvider) throw new ProviderNotFoundError();
    const accounts: string[] = await this.ethProvider.request({ method: "eth_accounts" } as unknown as any);
    return accounts.map((x: string) => getAddress(x));
  }

  async #fetchNetwork() {
    if (!this.ethProvider) throw new ProviderNotFoundError();
    const kakarotChainId = Number(
      await this.ethProvider.request({ method: "eth_chainId" } as unknown as any),
    );
    const correspondingStarknetChain =
      getCorrespondingStarknetChain(kakarotChainId);
    if (!correspondingStarknetChain) {
      throw new Error(`Unknown chain id: ${kakarotChainId}`);
    }
    return correspondingStarknetChain;
  }

  get chainId(): string {
    return this.#chainId.toString();
  }

  /**
   * Initializes the wallet by fetching the network and account information.
   * and sets the network, address, account object and provider object.
   *
   * @param createLock - The flag to enable/disable the mutex lock. Default is true.
   */
  async init(createLock = true) {
    if (createLock) {
      await this.lock.runExclusive(async () => {
        await this.#init();
      });
    } else {
      await this.#init();
    }
  }

  async #init() {
    let network: StarknetChain;
    try {
      network = await this.#fetchNetwork();
    } catch (error) {
      network = DEFAULT_CHAIN.starknetChain;
    }
    if (!network) {
      throw new Error("Unable to find the selected network");
    }

    if (!this.#starknetNetwork || network !== this.#starknetNetwork) {
      // address depends on network, if network changes, address will update
      this.#selectedAddress = await this.#getWalletAddress();
      // provider depends on network.nodeUrl, if network changes, set provider to undefine for reinitialization
      this.#starknetProvider = undefined;
      // account depends on address and provider, if network changes, address will update,
      // hence set account to undefine for reinitialization
      this.#account = undefined;
    }

    this.#starknetNetwork = network;
    this.#chainId = network.id;
    this.isConnected = true;
  }

  /**
   * Initializes the `KakarotAdapter` object and retrieves an array of addresses.
   * Currently, the array contains only one address, but it is returned as an array to
   * accommodate potential support for multiple addresses in the future.
   *
   * @returns An array of address.
   */
  async enable() {
    await this.init();
    return [this.selectedAddress];
  }

  async isPreauthorized() {
    return true;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  on<Event extends keyof WalletEventHandlers>(
    _event: Event,
    _handleEvent: WalletEventHandlers[Event],
  ): void {
    // No operation for now
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  off<Event extends keyof WalletEventHandlers>(
    _event: Event,
    _handleEvent?: WalletEventHandlers[Event],
  ): void {
    // No operation for now
  }
}

export class ProviderNotFoundError extends Error {
  constructor() {
    super("Provider not found.");
  }
}

export const getCorrespondingStarknetChain = (
  chainId: number,
): StarknetChain | undefined => {
  const starknetChain = Object.values(CHAIN_CONFIGS).find(
    (config) => config.kakarotChain.id === chainId,
  )?.starknetChain;
  return starknetChain;
};

export const getCorrespondingKakarotChain = (
  starknetChainId: number,
): KakarotChain | undefined => {
  return Object.values(CHAIN_CONFIGS).find(
    (config) => Number(config.starknetChain) === starknetChainId,
  )?.kakarotChain;
};

export const prepareTransactionData = (calls: Call[]) => {
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
    return encoded.slice(2);
  });

  const concatenatedCalls = encodedCalls.join("");
  const callCount = toHex(calls.length, { size: 32 }).slice(2);
  return `0x${callCount}${concatenatedCalls}` as `0x${string}`;
};
