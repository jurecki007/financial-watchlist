/**
 * Parses ROADMAP.md into the projection published at /roadmap.
 *
 * ROADMAP.md is the single source of truth — ticking a box there updates the
 * live page. But the file is written for us, not for an audience: it contains
 * build-strategy language, an effort:impact table, and advice about what to cut
 * if time runs short. A reviewer landing on /roadmap must not be reading our
 * notes about how to impress them.
 *
 * So content is opted IN, never out. This parser reads exactly two things:
 * checkbox lines inside `### Phase N` headings, and the name column of the
 * add-ons table. Everything else in the file — prose, tables, the cutoff
 * advice, the note explaining this very mechanism — is unreachable by
 * construction. A future edit to ROADMAP.md cannot leak strategy onto the live
 * site, because nothing but those two shapes is ever looked at.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type ItemState = "shipped" | "blocked" | "pending";

export type Item = {
  state: ItemState;
  /** The item itself, with any trailing annotation split off. */
  text: string;
  /** The part after an em dash: a PR number, a live URL, what it waits on. */
  note?: string;
};

export type Group = {
  /** Bold sub-heading inside a phase, e.g. "Landing page". */
  label?: string;
  items: Item[];
};

export type Phase = {
  number: number;
  title: string;
  groups: Group[];
  shipped: number;
  total: number;
};

export type Roadmap = {
  phases: Phase[];
  /** Add-on names only. Effort and impact columns are never read. */
  next: { name: string; done: boolean }[];
  shipped: number;
  total: number;
};

const CHECKBOX = /^-\s+\[( |x)\]\s+(.*)$/i;
const PHASE_HEADING = /^###\s+Phase\s+(\d+)\s*[—-]\s*(.+)$/;
/**
 * A group label is a line that is ENTIRELY bold, optionally with a trailing
 * colon. Matching a leading `**…**` instead would swallow ordinary prose that
 * merely starts with a bold clause — "**Phase 1 complete.** Two follow-ups…"
 * became a sub-heading and mislabelled every item under it.
 */
const GROUP_LABEL = /^\*\*(.+?)\*\*:?\s*$/;
const MVP_HEADING = /^##\s+.*MVP/;
const ADDON_HEADING = /^##\s+.*Add-ons/;

/** Strips markdown that would render as literal punctuation in JSX. */
function clean(raw: string): string {
  return raw
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links → their text
    .replace(/~~/g, "")
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/\*/g, "")
    .trim();
}

/**
 * An item is blocked if its annotation says so. Reading state from the prose
 * the author already writes means there is no second place to keep it in sync
 * — a blocked note and a blocked marker cannot disagree.
 */
function stateOf(checked: boolean, note: string | undefined): ItemState {
  if (checked) return "shipped";
  if (note && /blocked|waiting on/i.test(note)) return "blocked";
  return "pending";
}

function parseItem(checked: boolean, body: string): Item {
  // Split on the em dash that separates an item from its annotation. Only the
  // first one — later dashes belong to the note.
  const [head, ...rest] = body.split(/\s+—\s+/);
  const note = rest.length ? clean(rest.join(" — ")) : undefined;
  return { state: stateOf(checked, note), text: clean(head), note };
}

export function parseRoadmap(markdown: string): Roadmap {
  const lines = markdown.split("\n");
  const phases: Phase[] = [];
  const next: { name: string; done: boolean }[] = [];

  let section: "none" | "mvp" | "addons" = "none";
  let phase: Phase | null = null;
  let group: Group | null = null;

  for (const line of lines) {
    if (MVP_HEADING.test(line)) {
      section = "mvp";
      continue;
    }
    if (ADDON_HEADING.test(line)) {
      section = "addons";
      phase = null;
      continue;
    }
    // Any other level-2 heading closes the allowlisted region. This is what
    // makes new sections private by default.
    if (/^##\s+/.test(line)) {
      section = "none";
      phase = null;
      continue;
    }

    if (section === "mvp") {
      const heading = line.match(PHASE_HEADING);
      if (heading) {
        phase = {
          number: Number(heading[1]),
          title: clean(heading[2]),
          groups: [],
          shipped: 0,
          total: 0,
        };
        phases.push(phase);
        group = null;
        continue;
      }
      if (!phase) continue;

      const checkbox = line.match(CHECKBOX);
      if (checkbox) {
        if (!group) {
          group = { items: [] };
          phase.groups.push(group);
        }
        const item = parseItem(checkbox[1].toLowerCase() === "x", checkbox[2]);
        group.items.push(item);
        phase.total += 1;
        if (item.state === "shipped") phase.shipped += 1;
        continue;
      }

      const label = line.match(GROUP_LABEL);
      if (label && !line.startsWith("- ")) {
        group = { label: clean(label[1]), items: [] };
        phase.groups.push(group);
      }
      continue;
    }

    if (section === "addons" && line.startsWith("|")) {
      const cells = line.split("|").map((c) => c.trim());
      // | # | Add-on | Effort | Impact |  →  cells[2] is the name.
      // Columns 3 and 4 are deliberately never read.
      const name = cells[2];
      if (!name || /^-+$/.test(name) || name === "Add-on") continue;
      next.push({ name: clean(name), done: name.includes("~~") });
    }
  }

  // Drop phases that parsed to nothing rather than rendering an empty shell.
  const kept = phases.filter((p) => p.total > 0);

  return {
    phases: kept,
    next,
    shipped: kept.reduce((n, p) => n + p.shipped, 0),
    total: kept.reduce((n, p) => n + p.total, 0),
  };
}

/** Reads ROADMAP.md from the repo root at build time. */
export function loadRoadmap(): Roadmap {
  const markdown = readFileSync(join(process.cwd(), "ROADMAP.md"), "utf8");
  return parseRoadmap(markdown);
}
