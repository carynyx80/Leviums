import { getAddress } from "ethers";

export const CHAIN_ID = 56;
const DEFAULT_RPCS = [
  "https://bsc-dataseed.binance.org",
  "https://bsc-rpc.publicnode.com",
  "https://bsc-dataseed1.defibit.io",
];
const primary = (process.env.BSC_RPC_URL || "").trim();
export const RPC_URLS = [...new Set([primary || DEFAULT_RPCS[0], ...DEFAULT_RPCS])];
export const TREASURY = getAddress(
  (process.env.TREASURY_ADDRESS || "0x7d6b84648Fe791b2a2623b8B4D6fbB00ce7daB76").trim()
);
export const DATA_DIR = process.env.DATA_DIR || "./data";
export const PORT = Number(process.env.PORT) || 8080;
export const PANCAKE_V2_FACTORY = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73";
export const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
