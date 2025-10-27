/**
 * @file helpers.js
 * @description Generic Athena UI utility functions for IPFS normalization,
 * safe JSON downloads, and data formatting. v2.2
 */

/**
 * Normalize IPFS or GitHub URLs for browser-safe access.
 * Converts ipfs:// → https://ipfs.io/ipfs/
 * Optionally allows a custom gateway override.
 *
 * @param {string} url - IPFS or standard URL
 * @param {string} [gateway="https://ipfs.io/ipfs/"] - Alternate IPFS gateway
 * @returns {string} Safe HTTP URL
 */
export function sanitizeIpfsUrl(url, gateway = "https://ipfs.io/ipfs/") {
  if (!url) return "";
  if (url.startsWith("ipfs://")) {
    return url.replace("ipfs://", gateway);
  }
  // Normalize GitHub raw links if needed
  if (url.includes("github.com") && url.includes("/blob/")) {
    return url.replace("github.com", "raw.githubusercontent.com").replace("/blob/", "/");
  }
  return url;
}

/**
 * Safely download a JavaScript object as a JSON file.
 * Automatically embeds a timestamp and optional version info.
 *
 * @param {Object} obj - Data object to download
 * @param {string} [filename="data.json"] - Desired filename
 * @param {string} [version] - Optional schema or config version
 */
export function downloadJSON(obj, filename = "data.json", version) {
  try {
    const data = {
      ...obj,
      _meta: {
        version: version || obj.version || "2.2",
        downloadedAt: new Date().toISOString(),
      },
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("[helpers] JSON download failed:", err);
  }
}

/**
 * Format large numeric values with commas (and optional fixed decimals).
 * Example: 1234567.89 → "1,234,567.89"
 *
 * @param {number|string} num
 * @param {number} [decimals=2]
 * @returns {string}
 */
export function formatNumber(num, decimals = 2) {
  const n = Number(num);
  if (isNaN(n)) return "—";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
