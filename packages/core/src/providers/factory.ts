import type { Chain } from "../chains/types";
import type { ProviderInterface } from "starknet";

export type ChainProviderFactory<
  T extends ProviderInterface = ProviderInterface,
> = (chain: Chain) => T | null;
