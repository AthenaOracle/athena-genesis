// src/hooks/useBtcHistory.js
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Lightweight BTC/USD history hook using Binance klines.
 * No API key needed, good CORS, tiny responses.
 *
 * timeframes: '1h' | '4h' | '1d' | '1w'
 *
 * Returns:
 * - price: latest close
 * - series: [{ t: number (ms), p: number }] ascending
 * - isLoading, error, refetch()
 */
const MAP = {
  "1h": { interval: "1m", limit: 60, pollMs: 15_000 },
  "4h": { interval: "5m", limit: 48, pollMs: 60_000 },
  "1d": { interval: "15m", limit: 96, pollMs: 300_000 },
  "1w": { interval: "1h", limit: 24 * 7, pollMs: 1_800_000 },
};

export default function useBtcHistory(timeframe = "1d") {
  const cfg = MAP[timeframe] ?? MAP["1d"];
  const [series, setSeries] = useState([]);
  const [price, setPrice] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [err, setErr] = useState(null);
  const abortRef = useRef(null);

  const endpoint = useMemo(() => {
    const url = new URL("https://api.binance.com/api/v3/klines");
    url.searchParams.set("symbol", "BTCUSDT");
    url.searchParams.set("interval", cfg.interval);
    url.searchParams.set("limit", String(cfg.limit));
    return url.toString();
  }, [cfg.interval, cfg.limit]);

  const fetchNow = async () => {
    setErr(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch(endpoint, { signal: controller.signal, cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rows = await res.json();
      // Kline structure: [ openTime, open, high, low, close, volume, closeTime, ...]
      const pts = rows.map((r) => ({
        t: r[0], // open time ms
        p: Number(r[4]),
      }));
      setSeries(pts);
      setPrice(pts.length ? pts[pts.length - 1].p : null);
      setIsLoading(false);
    } catch (e) {
      if (e.name !== "AbortError") {
        setErr(e);
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    setIsLoading(true);
    setSeries([]);
    setPrice(null);
    fetchNow();

    // smart polling based on timeframe
    const id = setInterval(fetchNow, cfg.pollMs);

    return () => {
      clearInterval(id);
      if (abortRef.current) abortRef.current.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]); // endpoint already depends on timeframe via cfg

  return {
    price,
    series,
    isLoading,
    error: err,
    refetch: fetchNow,
  };
}
