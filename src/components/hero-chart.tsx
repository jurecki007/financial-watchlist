"use client";

import { useEffect, useRef, useState } from "react";
import fixture from "@/lib/fixtures/xau-daily.json";

type Bar = { time: string; open: number; high: number; low: number; close: number };

const BARS = fixture.bars as Bar[];

/**
 * Self-drawing XAU/USD candlestick hero.
 *
 * Data is a committed fixture, not a live call. The landing page is the
 * highest-traffic route and the least defensible place to spend an 800-call
 * daily budget — and it means the first thing anyone sees can never be an
 * error state, however the providers are behaving.
 *
 * The chart is decorative in the strict sense: `aria-hidden`, no pointer
 * events, no crosshair. The dataviz default is to ship a hover layer on any
 * plotted series, and the interactive charts on the company pages will have
 * one. Here the headline sits over the plot, so a crosshair would be a hit
 * target competing with reading, and a tooltip would obscure the copy it sits
 * behind. The prices carry no meaning the visitor must extract; they are
 * showing what the product does.
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

        const css = getComputedStyle(document.documentElement);
        const token = (name: string, fallback: string) =>
          css.getPropertyValue(name).trim() || fallback;

        const up = token("--up", "#2dd4bf");
        const down = token("--down", "#f87171");

        const chart = createChart(el, {
          layout: {
            background: { type: ColorType.Solid, color: "transparent" },
            textColor: token("--faint", "#6b6e74"),
            attributionLogo: false,
          },
          width: el.clientWidth,
          height: el.clientHeight,
          grid: {
            vertLines: { visible: false },
            horzLines: { color: "rgba(255,255,255,0.028)" },
          },
          // Axes off. This is an ambient demonstration, not an instrument —
          // price and date labels invite reading precise values the visitor has
          // no reason to want here, and they clutter the copy's ground.
          rightPriceScale: { visible: false },
          leftPriceScale: { visible: false },
          timeScale: { visible: false, fixLeftEdge: true, fixRightEdge: true },
          // Ambient, not a tool — see the note above.
          handleScroll: false,
          handleScale: false,
          crosshair: { mode: 2, vertLine: { visible: false }, horzLine: { visible: false } },
        });

        const series = chart.addSeries(CandlestickSeries, {
          upColor: up,
          downColor: "transparent", // hollow body = down, filled = up
          wickUpColor: up,
          wickDownColor: down,
          borderUpColor: up,
          borderDownColor: down,
          priceLineVisible: false,
          lastValueVisible: false,
        });

        chart.timeScale().fitContent();

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
          // Draw the series in rather than fading it in. Feeding bars one frame
          // at a time is the idiomatic way to animate lightweight-charts, which
          // has no built-in entrance, and it reads as the market printing.
          let i = 0;
          const step = () => {
            if (disposed) return;
            // A few bars per frame: 160 bars at one per frame is ~2.7s, which
            // is long enough that a visitor waits for it rather than watches it.
            i = Math.min(i + 3, BARS.length);
            series.setData(BARS.slice(0, i));
            chart.timeScale().fitContent();
            if (i < BARS.length) frame = requestAnimationFrame(step);
          };
          frame = requestAnimationFrame(step);
        }

        cleanup = () => {
          window.removeEventListener("resize", resize);
          cancelAnimationFrame(frame);
          chart.remove();
        };
      } catch {
        // The page must still read if the chart bundle fails. The hero degrades
        // to its gradient ground and the copy is untouched.
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
