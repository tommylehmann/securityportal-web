// This file is Free Software under the Apache-2.0 License
// without warranty, see README.md and LICENSES/Apache-2.0.txt for details.
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileCopyrightText: 2026 Tommy Lehmann

// Svelte context wiring for i18n. The root layout creates one i18n context from
// the server-resolved locale + catalog and provides it; any component reads it
// with `getI18n()` and calls `i18n.t('some.key')`.
//
// The context value is a *reactive* handle: its `locale` and the catalog it
// translates against are `$state`, and `t` reads that state at call time rather
// than closing over a snapshot. So when the locale toggle re-runs the loads and
// the layout pushes the new catalog into the same handle (`update()`), every
// `t(...)` call site re-evaluates and the whole chrome switches in place — even
// in child route components that destructured `const { t } = getI18n()` once.
//
// Request-scoping holds: the handle is a per-instance `$state`, created during
// the layout component's init. Each SSR render constructs its own layout
// component and therefore its own handle, so concurrent requests with different
// locales never share state. There is no module-level mutable singleton.

import { getContext, setContext } from "svelte";
import { catalogFor, createTranslator, type Locale, type Messages, type Translate } from "./index";

const I18N_KEY = Symbol("i18n");

/** The reactive i18n handle exposed to components. */
export interface I18nContext {
  /** The active locale (e.g. for `<html lang>` or locale-aware formatting). */
  readonly locale: Locale;
  /** Translate a key with optional `{placeholder}` params. */
  readonly t: Translate;
  /**
   * Replaces the active locale + catalog. Called by the root layout from an
   * effect on its (reactive) load data, so an in-place locale toggle re-renders
   * every `t(...)` consumer.
   */
  update(locale: Locale, messages?: Messages): void;
}

// Reactive backing for the i18n handle. `locale` and `catalog` are `$state`, so
// the derived `t` (and any markup that calls it) re-evaluates whenever the layout
// pushes a new locale via `update()`.
class ReactiveI18n implements I18nContext {
  #locale = $state<Locale>("en");
  #catalog = $state<Messages>(catalogFor("en"));
  // A translator over the *current* catalog. `$derived` recomputes when the
  // catalog changes; `t` is an arrow so destructuring (`const { t } = ...`)
  // keeps it bound to this instance's reactive state.
  #translate = $derived(createTranslator(this.#catalog));

  constructor(locale: Locale, messages?: Messages) {
    this.#locale = locale;
    this.#catalog = messages ?? catalogFor(locale);
  }

  get locale(): Locale {
    return this.#locale;
  }

  readonly t: Translate = (key, params) => this.#translate(key, params);

  update(locale: Locale, messages?: Messages): void {
    this.#locale = locale;
    this.#catalog = messages ?? catalogFor(locale);
  }
}

/**
 * Creates the i18n context from a locale and provides it to descendants. Called
 * once in the root layout. `messages` is optional: when omitted the bundled
 * catalog for the locale is used (the catalogs are tiny and bundled either way),
 * but the layout passes the catalog it received from the server for symmetry.
 *
 * The returned handle is reactive: keep the reference and call `update()` when
 * the locale changes rather than calling `setI18n()` again.
 */
export function setI18n(locale: Locale, messages?: Messages): I18nContext {
  const ctx = new ReactiveI18n(locale, messages);
  setContext(I18N_KEY, ctx);
  return ctx;
}

/** Reads the i18n context provided by the root layout. */
export function getI18n(): I18nContext {
  const ctx = getContext<I18nContext | undefined>(I18N_KEY);
  if (!ctx) {
    throw new Error("i18n context is not set; call setI18n() in the root layout");
  }
  return ctx;
}
