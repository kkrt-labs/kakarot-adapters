import { defineChain } from "viem";

import { Chain as StarknetChain } from "./types.js";
import { Chain as KakarotChain } from "viem";
import { sepolia as sn_sepolia } from "./starknet.js";

type ChainConfig = {
  kakarotChain: KakarotChain;
  starknetChain: StarknetChain;
  kakarotDeployment: string;
};

export const CHAIN_CONFIGS: Record<number, ChainConfig> = {
  [Number(sn_sepolia.id)]: {
    kakarotChain: /*#__PURE__*/ defineChain({
      id: 920637907288165,
      name: "Kakarot Sepolia",
      nativeCurrency: {
        name: "Ether",
        symbol: "ETH",
        decimals: 18,
      },
      rpcUrls: {
        default: {
          http: ["https://sepolia-rpc.kakarot.org"],
        },
      },
      blockExplorers: {
        default: {
          name: "Kakarot Scan",
          url: "https://sepolia.kakarotscan.org",
        },
      },
      testnet: true,
    }),
    starknetChain: sn_sepolia,
    kakarotDeployment:
      "0x1d2e513630d8120666fc6e7d52ad0c01479fd99c183baac79fff9135f46e359",
  },
};

// TODO: default chain _should_ be sn_mainnet once live.
export const kakarotSepolia =
  CHAIN_CONFIGS[Number(sn_sepolia.id)]!.kakarotChain;
export const DEFAULT_CHAIN = CHAIN_CONFIGS[Number(sn_sepolia.id)]!;
