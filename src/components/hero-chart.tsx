"use client";

import { useEffect, useRef, useState } from "react";
import fixture from "@/lib/fixtures/xau-daily.json";

type Bar = { time: string; open: number; high: number; low: number; close: number };

const BARS = fixture.bars as Bar[];

/**
 * How long the hero takes to draw itself in.
 *
 * Long enough to be watched rather than merely noticed — the draw-in is this
 * page's loading state (CLAUDE.md, Loading Behaviour 7), so it should read as
 * the market printing, not as a transition that already finished. Short enough
 * that the CTA beneath it is never gated on the animation: the headline and
 * both buttons are server-rendered and clickable throughout.
 */
const DRAW_MS = 4200;

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

        // Re-read on every call rather than closing over one snapshot: the
        // toggle in the hero can flip the theme while this chart is mounted,
        // and a cached palette would leave dark-theme candles on a light page.
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

        // The head script and the toggle both write data-theme on <html>, so
        // that attribute is the single signal for a palette change.
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
          // Draw the series in rather than fading it in. Feeding bars a frame
          // at a time is the idiomatic way to animate lightweight-charts, which
          // has no built-in entrance, and it reads as the market printing.
          //
          // Driven by elapsed time, not by a per-frame bar count. The previous
          // "+3 bars per frame" tied the duration to the display: 160 bars ran
          // ~0.9s on a 60Hz panel and ~0.45s on a 120Hz one, so the hero was
          // twice as fast on exactly the hardware most likely to be reviewing
          // it. Wall-clock time makes the pace a decision instead of a
          // property of the monitor.
          let start: number | null = null;
          const step = (now: number) => {
            if (disposed) return;
            start ??= now;
            const t = Math.min(1, (now - start) / DRAW_MS);
            // Ease-out: the market arrives quickly, then settles. Linear read
            // as a progress bar filling.
            const eased = 1 - Math.pow(1 - t, 3);
            // At least one bar on the first frame so the chart never flashes
            // empty between mount and the first candle.
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
