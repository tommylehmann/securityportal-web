// This file is Free Software under the Apache-2.0 License
// without warranty, see README.md and LICENSES/Apache-2.0.txt for details.
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileCopyrightText: 2026 Tommy Lehmann

import type { DocModel } from "$lib/CSAFWebview/docmodel/docmodeltypes";

// Slim, self-contained store for the vendored CSAFWebview viewer. It carries
// only the document view-model and the small amount of transient UI state the
// single-document components read. ISDuBA's full app store (auth, search,
// workflow, diff, …) is intentionally not reproduced here — this portal renders
// a single document at a time and has no authenticated app shell.
type WebviewState = {
  webview: {
    doc: DocModel | null;
    // CVE names highlighted in the product/vulnerabilities cross-table. ISDuBA
    // populates this from its search feature; the public viewer leaves it empty.
    four_cves: string[];
    ui: {
      // CVE/product selected via an in-document link, used to auto-open and
      // scroll to the matching section.
      selectedCVE: string;
      selectedProduct: string;
      // Scroll anchors for in-document back navigation.
      history: string[];
    };
  };
};

const generateInitialState = (): WebviewState => {
  return {
    webview: {
      doc: null,
      four_cves: [],
      ui: {
        selectedCVE: "",
        selectedProduct: "",
        history: []
      }
    }
  };
};

const state = $state(generateInitialState());

export const appStore = {
  get state() {
    return state;
  },

  setDocument: (doc: DocModel | null) => {
    state.webview.doc = doc;
  },

  setSelectedCVE: (cve: string) => {
    state.webview.ui.selectedCVE = cve;
  },

  resetSelectedCVE: () => {
    state.webview.ui.selectedCVE = "";
  },

  setSelectedProduct: (product: string) => {
    state.webview.ui.selectedProduct = product;
  },

  resetSelectedProduct: () => {
    state.webview.ui.selectedProduct = "";
  },

  shiftHistory: () => {
    if (state.webview.ui.history.length > 0) {
      state.webview.ui.history.shift();
    }
  },

  reset: () => {
    Object.assign(state, generateInitialState());
  }
};
