/**
 * @file format.js
 * @description Formatting helpers for ATA token amounts and wallet addresses.
 */

/**
 * Convert raw on-chain (wei) amount → human-readable ATA.
 * @param {string|number} raw - Raw amount in wei
 * @returns {string} Formatted ATA value (e.g., "12.3456")
 */
export function formatAtaAmount(raw) {
  if (!raw) return "0.00";
  const num = typeof raw === "string" ? Number(raw) : raw;
  return (num / 1e18).toFixed(4);
}

/**
 * Shorten an Ethereum address for UI display.
 * @param {string} addr - Wallet address
 * @returns {string} Shortened address (e.g., 0x1234...ABCD)
 */
export function shortAddress(addr) {
  if (!addr || addr.length < 10) return addr || "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
