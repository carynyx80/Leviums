import { isAddress, getAddress } from "ethers";

export function badRequest(msg) {
  return Object.assign(new Error(msg), { status: 400, noRetry: true });
}

export function requireAddress(value, field) {
  if (typeof value !== "string" || !isAddress(value.trim())) throw badRequest(`input.${field} must be a valid 0x address`);
  return getAddress(value.trim().toLowerCase());
}

export const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));
export const verdictFor = (score) => (score >= 70 ? "SAFE" : score >= 40 ? "CAUTION" : "DANGER");
export const round = (n, d = 4) => Number(Number(n).toFixed(d));
