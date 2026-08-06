"use client";

import { useEffect, useRef, useState } from "react";
import fixture from "@/lib/fixtures/xau-daily.json";

type Bar = { time: string; open: number; high: number; low: number; close: number };

const BARS = fixture.bars as Bar[];

/** The draw-in is this page's loading state, so it is watched, not just noticed. */
const DRAW_MS = 4200;

/**
 * Self-drawing XAU/USD candlestick hero.
 *
 * A committed fixture rather than a live call: the landing page is the busiest
 * route and the worst place to spend the daily budget, and this way the first
 * thing anyone sees can never be an error state.
 *
 * Decorative in the strict sense — aria-hidden, no pointer events, no
 * crosshair. The headline sits over the plot, so interactivity would compete
 * with reading it.
 */
export function HeroChart() {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = container.current;
    if (!el) return;

    let disposed = false;
    let frame = 0;
    let cleanup: (() => void) | undefined;

    (async () => {
      try {
        // Dynamically imported so ~45kB of charting never blocks first paint.
        // The headline is the LCP; this arrives afterwards as an enhancement.
        const { createChart, CandlestickSeries, ColorType } = await import(
          "lightweight-charts"
        );
        if (disposed || !container.current) return;

        // Re-read per call: the theme can flip while this is mounted, and a
        // canvas inherits no CSS.
        const readTokens = () => {
          const css = getComputedStyle(document.documentElement);
          const token = (name: string, fallback: string) =>
            css.getPropertyValue(name).trim() || fallback;
          return {
            text: token("--faint", "#6b6e74"),
            grid: token("--chart-grid", "rgba(255,255,255,0.028)"),
            up: token("--up", "#2dd4bf"),
            down: token("--down", "#f87171"),
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
          // Axes off: ambient demonstration, not an instrument.
          rightPriceScale: { visible: false },
          leftPriceScale: { visible: false },
          timeScale: { visible: false, fixLeftEdge: true, fixRightEdge: true },
          handleScroll: false,
          handleScale: false,
          crosshair: { mode: 2, vertLine: { visible: false }, horzLine: { visible: false } },
        });

        const series = chart.addSeries(CandlestickSeries, {
          upColor: initial.up,
          downColor: "transparent", // hollow body = down, filled = up
          wickUpColor: initial.up,
          wickDownColor: initial.down,
          borderUpColor: initial.up,
          borderDownColor: initial.down,
          priceLineVisible: false,
          lastValueVisible: false,
        });

        chart.timeScale().fitContent();

        // data-theme on <html> is the single signal for a palette change.
        const applyTheme = () => {
          const t = readTokens();
          chart.applyOptions({
            layout: { textColor: t.text },
            grid: { horzLines: { color: t.grid } },
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

        const resize = () => {
          if (!container.current) return;
          chart.applyOptions({
            width: container.current.clientWidth,
            height: container.current.clientHeight,
          });
          chart.timeScale().fitContent();
        };
        window.addEventListener("resize", resize);

        const reduced = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;

        if (reduced) {
          // Not a degraded version — the same final frame, arrived at instantly.
          series.setData(BARS);
          chart.timeScale().fitContent();
        } else {
          // Feeding bars a frame at a time is the idiomatic entrance for
          // lightweight-charts, which has none built in.
          //
          // Driven by elapsed time, not a per-frame bar count — the latter ties
          // the duration to the refresh rate, running twice as fast at 120Hz.
          let start: number | null = null;
          const step = (now: number) => {
            if (disposed) return;
            start ??= now;
            const t = Math.min(1, (now - start) / DRAW_MS);
            // Ease-out; linear reads as a progress bar filling.
            const eased = 1 - Math.pow(1 - t, 3);
            // At least one bar, so it never flashes empty on mount.
            const i = Math.max(1, Math.round(eased * BARS.length));
            series.setData(BARS.slice(0, i));
            chart.timeScale().fitContent();
            if (t < 1) frame = requestAnimationFrame(step);
          };
          frame = requestAnimationFrame(step);
        }

        cleanup = () => {
          window.removeEventListener("resize", resize);
          themeWatcher.disconnect();
          cancelAnimationFrame(frame);
          chart.remove();
        };
      } catch {
        // The hero degrades to its gradient ground; the copy is untouched.
        if (!disposed) setFailed(true);
      }
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      cleanup?.();
    };
  }, []);

  return (
    <div
      ref={container}
      aria-hidden
      data-failed={failed || undefined}
      className="absolute inset-0 z-0 [&_canvas]:!pointer-events-none"
    />
  );
}
