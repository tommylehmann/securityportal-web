// This file is Free Software under the Apache-2.0 License
// without warranty, see README.md and LICENSES/Apache-2.0.txt for details.
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileCopyrightText: 2026 Tommy Lehmann

// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
import type { Locale } from "$lib/i18n";

declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      /** UI locale resolved in hooks.server.ts (cookie → Accept-Language). */
      locale: Locale;
    }
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
