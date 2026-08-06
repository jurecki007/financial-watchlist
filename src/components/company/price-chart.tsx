"use client";

import { useEffect, useRef, useState } from "react";
import type { Candle } from "@/lib/market-data";
import { useToast } from "@/components/ui/toast";

/**
 * The company chart — an instrument, unlike the landing hero. It carries a
 * crosshair and a readout because here the numbers are the point. Direction is
 * filled (up) versus hollow (down) as well as coloured.
 *
 * History pages in on scroll: panning within PREFETCH_MARGIN bars of the left
 * edge fetches the next page and prepends it.
 */

/** Bars per page. The leading page is server-rendered at this size too. */
const PAGE_SIZE = 750;

/** Wide enough that the fetch usually resolves before the pan reaches the edge. */
const PREFETCH_MARGIN = 20;

/** Bars visible on arrival — roughly eight months. */
const INITIAL_VISIBLE = 180;

export function PriceChart({ candles, ticker }: { candles: Candle[]; ticker: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<Candle | null>(null);
  const [failed, setFailed] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const [loaded, setLoaded] = useState(candles.length);
  const { push } = useToast();

  // A ref, not state: re-rendering on every prepend would recreate the chart
  // and lose the scroll position paging exists to preserve.
  const barsRef = useRef<Candle[]>(candles);

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

        // Read fresh: the theme can change under a mounted chart, and a canvas
        // inherits no CSS.
        const readTokens = () => {
          const css = getComputedStyle(document.documentElement);
          const t = (n: string, f: string) =>
            css.getPropertyValue(n).trim() || f;
          return {
            text: t("--faint", "#6b6e74"),
            grid: t("--chart-grid", "rgba(255,255,255,0.04)"),
            rule: t("--rule", "#23262b"),
            ruleStrong: t("--rule-strong", "#333840"),
            up: t("--up", "#2dd4bf"),
            down: t("--down", "#f87171"),
          };
        };

        const initial = readTokens();

        const chart = createChart(el, {
          layout: {
            background: { type: ColorType.Solid, color: "transparent" },
            textColor: initial.text,
            attributionLogo: false,
          },
          width: el.clientWidth,
          height: el.clientHeight,
          grid: {
            vertLines: { visible: false },
            horzLines: { color: initial.grid },
          },
          rightPriceScale: { borderColor: initial.rule },
          timeScale: { borderColor: initial.rule },
          crosshair: {
            mode: CrosshairMode.Magnet,
            vertLine: { color: initial.text, width: 1, style: 3, labelBackgroundColor: initial.ruleStrong },
            horzLine: { color: initial.text, width: 1, style: 3, labelBackgroundColor: initial.ruleStrong },
          },
        });

        const series = chart.addSeries(CandlestickSeries, {
          upColor: initial.up,
          downColor: "transparent",
          wickUpColor: initial.up,
          wickDownColor: initial.down,
          borderUpColor: initial.up,
          borderDownColor: initial.down,
        });
        series.setData(barsRef.current);

        // Not fitContent(): 750 candles in a 22rem plot is a smear, and it
        // would leave the range at index 0 — inside the prefetch margin, so
        // every load would fetch a second page nobody asked for.
        const total = barsRef.current.length;
        chart.timeScale().setVisibleLogicalRange({
          from: Math.max(0, total - INITIAL_VISIBLE),
          to: total,
        });

        // Guarded by locals, not state: this fires many times a second while
        // panning, and a state update would not commit before the next read.
        let loading = false;
        let noMore = false;

        const loadOlder = async () => {
          if (loading || noMore || disposed) return;
          const oldest = barsRef.current[0]?.time;
          if (!oldest) return;

          loading = true;
          setLoadingOlder(true);
          try {
            const res = await fetch(
              `/api/candles?ticker=${encodeURIComponent(ticker)}&before=${oldest}&size=${PAGE_SIZE}`,
            );
            if (disposed) return;

            if (!res.ok) {
              // Bars stay on screen, so this is a background failure: a toast,
              // keyed by cause so a repeated pan reports once.
              push({
                key: "candles-older",
                title: "Couldn't load earlier sessions",
                body: "The chart is showing everything fetched so far. Try scrolling again in a moment.",
              });
              return;
            }

            const body = (await res.json()) as {
              candles?: Candle[];
              exhausted?: boolean;
            };
            if (disposed) return;

            const older = body.candles ?? [];
            if (body.exhausted || older.length === 0) {
              noMore = true;
              setExhausted(true);
              return;
            }

            // Pages should abut exactly, but a duplicate timestamp makes
            // lightweight-charts render wrong rather than throw.
            const seen = new Set(barsRef.current.map((c) => c.time));
            const fresh = older.filter((c) => !seen.has(c.time));
            if (fresh.length === 0) {
              noMore = true;
              setExhausted(true);
              return;
            }

            const merged = [...fresh, ...barsRef.current].sort((a, b) =>
              a.time.localeCompare(b.time),
            );

            barsRef.current = merged;

            // No range fix-up: `setData` re-anchors by time, not logical
            // index, so the pan continues uninterrupted. That is library
            // behaviour, so the invariant is pinned in e2e/chart-history.spec.ts.
            series.setData(merged);
            setLoaded(merged.length);
          } catch {
            if (!disposed) {
              push({
                key: "candles-older",
                title: "Couldn't load earlier sessions",
                body: "The chart is showing everything fetched so far. Try scrolling again in a moment.",
              });
            }
          } finally {
            loading = false;
            if (!disposed) setLoadingOlder(false);
          }
        };

        const onRange = (range: { from: number; to: number } | null) => {
          if (!range) return;
          // `from` is a logical index and goes negative once the user pans past
          // the first bar, so this fires slightly before the edge is reached.
          if (range.from < PREFETCH_MARGIN) void loadOlder();
        };
        chart.timeScale().subscribeVisibleLogicalRangeChange(onRange);

        const applyTheme = () => {
          const t = readTokens();
          chart.applyOptions({
            layout: { textColor: t.text },
            grid: { horzLines: { color: t.grid } },
            rightPriceScale: { borderColor: t.rule },
            timeScale: { borderColor: t.rule },
            crosshair: {
              vertLine: { color: t.text, labelBackgroundColor: t.ruleStrong },
              horzLine: { color: t.text, labelBackgroundColor: t.ruleStrong },
            },
          });
          series.applyOptions({
            upColor: t.up,
            wickUpColor: t.up,
            borderUpColor: t.up,
            wickDownColor: t.down,
            borderDownColor: t.down,
          });
        };
        const themeWatcher = new MutationObserver(applyTheme);
        themeWatcher.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ["data-theme"],
        });

        // Readout of the hovered bar. Rendered in React beside the chart rather
        // than as a floating tooltip so it never covers the data it describes.
        const onMove = chart.subscribeCrosshairMove((param) => {
          if (!param.time) {
            setHover(null);
            return;
          }
          // The ref, not the prop: the prop is only the leading page.
          const bar = barsRef.current.find((c) => c.time === param.time);
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
          themeWatcher.disconnect();
          chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRange);
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
  }, [candles, ticker, push]);

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

        {/* Paging status, pushed right so it never displaces the OHLC figures
            as it changes. Reserved by `ml-auto` rather than by a fixed width:
            the row is the same height in all three states, so nothing shifts
            when one replaces another.

            `aria-live="polite"` because the chart itself is a role="img" that
            a screen reader cannot pan — the count growing is the only signal
            available that more history arrived. */}
        <span
          aria-live="polite"
          className="ml-auto text-[var(--faint)]"
        >
          {loadingOlder ? (
            // No spinner. The pan is still interactive and the drawn bars are
            // still readable, so this reports rather than blocks.
            <span className="animate-pulse motion-reduce:animate-none">
              loading earlier sessions…
            </span>
          ) : exhausted ? (
            `${loaded} sessions · start of history`
          ) : (
            `${loaded} sessions`
          )}
        </span>
      </div>
      <div
        ref={container}
        role="img"
        aria-label={
          exhausted
            ? `Daily price chart for ${ticker}, ${loaded} sessions, the full available history`
            : `Daily price chart for ${ticker}, ${loaded} sessions loaded, more load when panned earlier`
        }
        className="h-[22rem] w-full border border-[var(--rule)]"
      />
    </div>
  );
}
