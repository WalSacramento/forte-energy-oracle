/**
 * Display formatting helpers for the EAON frontend.
 */

/** Format a raw Wh bigint for human display (e.g. 1500000 → "1,500 kWh") */
export function formatWh(wh: bigint): string {
  if (wh >= 1_000_000n) {
    const mwh = Number(wh) / 1_000_000;
    return `${mwh.toFixed(2)} MWh`;
  }
  if (wh >= 1_000n) {
    const kwh = Number(wh) / 1_000;
    return `${kwh.toFixed(1)} kWh`;
  }
  return `${wh.toString()} Wh`;
}

/** Format a wei-per-Wh bigint as a readable ETH price (e.g. 1000000000000000n → "0.001 ETH/Wh") */
export function formatEthPrice(weiPerWh: bigint): string {
  const eth = Number(weiPerWh) / 1e18;
  if (eth < 0.0001) {
    return `${(eth * 1e6).toFixed(2)} µETH/Wh`;
  }
  return `${eth.toFixed(6)} ETH/Wh`;
}

/** Format total ETH cost from wei bigint */
export function formatEth(wei: bigint): string {
  const eth = Number(wei) / 1e18;
  if (eth < 0.001) {
    return `${(eth * 1000).toFixed(4)} mETH`;
  }
  return `${eth.toFixed(4)} ETH`;
}

/** Truncate an Ethereum address for display */
export function truncateAddress(address: string, chars = 4): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 2 + chars)}…${address.slice(-chars)}`;
}

/** Format a seconds-until-expiry countdown */
export function formatCountdown(secondsLeft: number): string {
  if (secondsLeft <= 0) return "Expired";
  const h = Math.floor(secondsLeft / 3600);
  const m = Math.floor((secondsLeft % 3600) / 60);
  const s = secondsLeft % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/** Format a Unix timestamp as a locale date string */
export function formatTimestamp(unixSeconds: bigint | number): string {
  const ms = typeof unixSeconds === "bigint" ? Number(unixSeconds) * 1000 : unixSeconds * 1000;
  return new Date(ms).toLocaleString();
}
