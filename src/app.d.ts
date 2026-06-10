// This file is Free Software under the Apache-2.0 License
// without warranty, see README.md and LICENSES/Apache-2.0.txt for details.
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileCopyrightText: 2026 Tommy Lehmann

/// <reference types="vite/client" />

// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
import type { Locale } from "$lib/i18n";

declare global {
  // Build-time version constant, injected by Vite's `define` (see
  // vite.config.ts) and rendered in the footer. Declared inside `declare global`
  // because this file is a module (it has imports), so a bare top-level
  // `declare const` would be module-scoped and invisible to .svelte files.
  const __APP_VERSION__: string;

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
