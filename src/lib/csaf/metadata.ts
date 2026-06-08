// This file is Free Software under the Apache-2.0 License
// without warranty, see README.md and LICENSES/Apache-2.0.txt for details.
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileCopyrightText: 2026 Tommy Lehmann

import type { Severity } from "$lib/api/types";
import { severityOf } from "$lib/api/client";

// Header-band metadata for the detail page, derived on the server from the
// verbatim CSAF JSON the document endpoint serves. The list endpoint exposes
// these as generated columns (spec §7), but the document endpoint serves only
// the raw JSON, and there is no by-id metadata endpoint in the read-only API
// (spec §8). Rather than a second browser round-trip to the list, we extract the
// same fields here from the document we already loaded — the field paths mirror
// the generated-column expressions (`{document,title}`, `{document,publisher,
// name}`, `{document,distribution,tlp,label}`, etc.) and the CVSS coalesce that
// drives `critical`.
//
// The withdrawn marker is intentionally absent: it lives on the `advisories`
// row, not in the CSAF document, and the document endpoint does not surface it
// (a withdrawn advisory's document is still served for permalink stability —
// securityportal-api getDocument). The page leaves room for it should a future
// endpoint expose it.

/** The header-band fields shown above the rendered viewer (spec §13). */
export interface AdvisoryMetadata {
  title: string | null;
  publisher: string | null;
  trackingId: string | null;
  category: string | null;
  tlp: string | null;
  currentReleaseDate: string | null;
  initialReleaseDate: string | null;
  version: string | null;
  /** Effective CVSS score (coalesce v3, v2); drives the severity badge. */
  score: number | null;
  severity: Severity;
  /** CVE ids in document order, de-duplicated; an empty array when none. */
  cves: string[];
}

/** Reads a string property off an unknown object, or null when absent/non-string. */
function str(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

/** Reads a finite number property off an unknown value, or null otherwise. */
function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Narrows an unknown value to an indexable record. */
function obj(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

/**
 * Walks the vulnerabilities array and collects the highest CVSS v2 and v3 base
 * scores across all scorings, matching the API's `max_cvss2_score` /
 * `max_cvss3_score` aggregation. Returns the effective `critical` score as
 * `coalesce(v3, v2)`.
 */
function maxScore(vulnerabilities: unknown): number | null {
  if (!Array.isArray(vulnerabilities)) return null;
  let v2: number | null = null;
  let v3: number | null = null;
  for (const vuln of vulnerabilities) {
    const scores = obj(vuln)?.scores;
    if (!Array.isArray(scores)) continue;
    for (const scoring of scores) {
      const s = obj(scoring);
      if (!s) continue;
      const base2 = num(obj(s.cvss_v2)?.baseScore);
      const base3 = num(obj(s.cvss_v3)?.baseScore);
      if (base2 !== null && (v2 === null || base2 > v2)) v2 = base2;
      if (base3 !== null && (v3 === null || base3 > v3)) v3 = base3;
    }
  }
  return v3 ?? v2;
}

/** Collects the distinct CVE ids across the document's vulnerabilities, in order. */
function collectCves(vulnerabilities: unknown): string[] {
  if (!Array.isArray(vulnerabilities)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const vuln of vulnerabilities) {
    const cve = str(obj(vuln)?.cve);
    if (cve !== null && !seen.has(cve)) {
      seen.add(cve);
      out.push(cve);
    }
  }
  return out;
}

/**
 * Extracts the header-band metadata from a verbatim CSAF document. Tolerant of a
 * malformed/partial document: every field falls back to null / empty so the band
 * renders em dashes rather than throwing on an unexpected shape.
 */
export function extractMetadata(document: unknown): AdvisoryMetadata {
  const doc = obj(obj(document)?.document);
  const tracking = obj(doc?.tracking);
  const publisher = obj(doc?.publisher);
  const tlp = obj(obj(doc?.distribution)?.tlp);

  const score = maxScore(obj(document)?.vulnerabilities);

  return {
    title: str(doc?.title),
    publisher: str(publisher?.name),
    trackingId: str(tracking?.id),
    category: str(doc?.category),
    tlp: str(tlp?.label),
    currentReleaseDate: str(tracking?.current_release_date),
    initialReleaseDate: str(tracking?.initial_release_date),
    version: str(tracking?.version),
    score,
    severity: severityOf({ critical: score }),
    cves: collectCves(obj(document)?.vulnerabilities)
  };
}
