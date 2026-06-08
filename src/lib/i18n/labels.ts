// This file is Free Software under the Apache-2.0 License
// without warranty, see README.md and LICENSES/Apache-2.0.txt for details.
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileCopyrightText: 2026 Tommy Lehmann

import type { Severity } from "$lib/api/types";
import type { MessageKey } from "$lib/i18n";

// Maps domain enum values to their (literal, type-checked) translation keys.
// Kept here so the severity band labels stay consistent across the result-list
// badge and the filter sidebar.
const SEVERITY_KEYS: Record<Severity, MessageKey> = {
  none: "severity.none",
  low: "severity.low",
  medium: "severity.medium",
  high: "severity.high",
  critical: "severity.critical"
};

/** Translation key for a CVSS severity band. */
export function severityLabelKey(severity: Severity): MessageKey {
  return SEVERITY_KEYS[severity];
}
