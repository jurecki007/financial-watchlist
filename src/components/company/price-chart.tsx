"use client";

import { useEffect, useRef, useState } from "react";
import type { Candle } from "@/lib/market-data";

/**
 * The company chart — an instrument, not atmosphere.
 *
 * Unlike the landing hero this ships the hover layer the dataviz default asks
 * for: crosshair plus a readout of the hovered bar. Here the numbers are the
 * point, someone came to read them, and nothing is overlaid on the plot to
 * compete for the pointer.
 *
 * Colour follows the same validated pair as everywhere else, and direction is
 * additionally carried by filled (up) versus hollow (down) bodies so it
 * survives colour being unavailable.
 */
export function PriceChart({ candles, ticker }: { candles: Candle[]; ticker: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<Candle | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = container.current;
    if (!el || candles.length === 0) return;

    let disposed = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      try {
        const { createChart, CandlestickSeries, ColorType, CrosshairMode } =
          await import("lightweight-charts");
        if (disposed || !container.current) return;

        const css = getComputedStyle(document.documentElement);
        const t = (n: string, f: string) => css.getPropertyValue(n).trim() || f;
        const up = t("--up", "#2dd4bf");
        const down = t("--down", "#f87171");

        const chart = createChart(el, {
          layout: {
            background: { type: ColorType.Solid, color: "transparent" },
            textColor: t("--faint", "#6b6e74"),
            attributionLogo: false,
          },
          width: el.clientWidth,
          height: el.clientHeight,
          grid: {
            vertLines: { visible: false },
            horzLines: { color: "rgba(255,255,255,0.04)" },
          },
          rightPriceScale: { borderColor: t("--rule", "#23262b") },
          timeScale: { borderColor: t("--rule", "#23262b") },
          crosshair: {
            mode: CrosshairMode.Magnet,
            vertLine: { color: t("--faint", "#6b6e74"), width: 1, style: 3, labelBackgroundColor: t("--rule-strong", "#333840") },
            horzLine: { color: t("--faint", "#6b6e74"), width: 1, style: 3, labelBackgroundColor: t("--rule-strong", "#333840") },
          },
        });

        const series = chart.addSeries(CandlestickSeries, {
          upColor: up,
          downColor: "transparent",
          wickUpColor: up,
          wickDownColor: down,
          borderUpColor: up,
          borderDownColor: down,
        });
        series.setData(candles);
        chart.timeScale().fitContent();

        // Readout of the hovered bar. Rendered in React beside the chart rather
        // than as a floating tooltip so it never covers the data it describes.
        const onMove = chart.subscribeCrosshairMove((param) => {
          if (!param.time) {
            setHover(null);
            return;
          }
          const bar = candles.find((c) => c.time === param.time);
          setHover(bar ?? null);
        });

        const resize = () => {
          if (!container.current) return;
          chart.applyOptions({
            width: container.current.clientWidth,
            height: container.current.clientHeight,
          });
        };
        window.addEventListener("resize", resize);

        cleanup = () => {
          window.removeEventListener("resize", resize);
          void onMove;
          chart.remove();
        };
      } catch {
        if (!disposed) setFailed(true);
      }
    })();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [candles]);

  const shown = hover ?? candles[candles.length - 1];
  const rising = shown ? shown.close >= shown.open : true;

  if (failed) {
    return (
      <div className="flex h-[22rem] items-center justify-center border border-[var(--rule)] px-6 text-center">
        <p className="text-sm text-[var(--dim)]">
          The chart couldn&rsquo;t load. The figures below are unaffected.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* OHLC readout. Always present, showing the latest bar until the pointer
          picks one — so the row never appears and disappears under the cursor. */}
      <div className="mb-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 font-mono text-xs tabular-nums">
        <span className="text-[var(--dim)]">{hover ? shown?.time : "latest"}</span>
        {(["open", "high", "low", "close"] as const).map((k) => (
          <span key={k} className="text-[var(--faint)]">
            {k[0].toUpperCase()}
            <span
              className={`ml-1 ${rising ? "text-[var(--up)]" : "text-[var(--down)]"}`}
            >
              {shown?.[k].toFixed(2)}
            </span>
          </span>
        ))}
      </div>
      <div
        ref={container}
        role="img"
        aria-label={`Daily price chart for ${ticker}, ${candles.length} sessions`}
        className="h-[22rem] w-full border border-[var(--rule)]"
      />
    </div>
  );
}
