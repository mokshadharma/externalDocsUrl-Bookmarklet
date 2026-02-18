javascript:(function () {
  'use strict';

  /* Bookmarklet: Resolve externalDocsUrl links
   *
   * On GitHub code view pages, replaces occurrences of
   * ${externalDocsUrl}/[path] with clickable links pointing to
   * https://docs.github.com/en/enterprise-cloud@latest/[path]
   *
   * Links open in a new tab and do not trigger GitHub's
   * underlying code view click handlers.
   *
   * GitHub's React-based code view layers invisible overlays
   * (a TEXTAREA for text selection and a cursor-container div)
   * on top of the visible code lines. These overlays intercept
   * all pointer events, making injected <a> elements visually
   * present but not directly clickable. To work around this,
   * the bookmarklet registers a document-level click listener
   * that checks whether the click coordinates fall within any
   * injected link's bounding rectangle (queried live via
   * getBoundingClientRect) and opens the URL if so. A matching
   * mousemove listener toggles a pointer cursor on hover.
   * This approach leaves all native overlays and behaviors
   * (text selection, copy-paste, line highlighting) intact.
   */

  const DOCS_BASE_URL = 'https://docs.github.com/en/enterprise-cloud@latest/';
  const PLACEHOLDER = '${externalDocsUrl}';

  /**
   * Regex to match ${externalDocsUrl}/[path] and capture the path.
   *
   *   \$\{externalDocsUrl\}  — literal ${externalDocsUrl} placeholder
   *   \/                     — literal / separator after the placeholder
   *   (                      — start capture group: the docs path
   *     [\w./#?&=%+~:,-]+    — one or more valid URL path characters:
   *                            \w = word chars (a-z, A-Z, 0-9, _)
   *                            .  = dot         /  = slash
   *                            #  = fragment     ?  = query
   *                            &  = ampersand    =  = equals
   *                            %  = percent-enc  +  = plus
   *                            ~  = tilde        :  = colon
   *                            ,  = comma        -  = hyphen
   *   )                      — end capture group
   *   /g                     — global flag: match all occurrences
   *
   * The character class limits the match to standard URL characters,
   * preventing the regex from greedily consuming surrounding text
   * (such as closing quotes, parentheses, or whitespace) that is
   * not part of the URL path.
   */
  const PLACEHOLDER_PATTERN = /\$\{externalDocsUrl\}\/([\w./#?&=%+~:,-]+)/g;

  /**
   * Target GitHub code view containers:
   *   .blob-wrapper          — classic file view code container
   *   .highlight             — syntax-highlighted code block (including table-based)
   *   .react-code-lines      — React-based file view (newer GitHub UI)
   *   .react-blob-print-hide — React-based file view print layout
   */
  const CODE_VIEW_SELECTOR = [
    '.blob-wrapper',
    '.highlight',
    '.react-code-lines',
    '.react-blob-print-hide',
  ].join(', ');

  /**
   * Find the GitHub code view containers to search within.
   * Falls back to document.body if none are found.
   */
  function findCodeContainers() {
    const containers = document.querySelectorAll(CODE_VIEW_SELECTOR);
    return containers.length ? containers : [document.body];
  }

  /**
   * Non-rendered elements whose text content should never be processed.
   * When the walker's scope is document.body (fallback), these elements
   * would otherwise match — e.g. GitHub embeds file contents as JSON
   * inside <script> tags for SPA hydration. TEXTAREA is included
   * because it can only hold plain text; inserting HTML children into
   * one is meaningless and wastes processing.
   */
  const NON_RENDERED_TAGS = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT', 'TEXTAREA']);

  /**
   * Walk the DOM within the given scopes and collect all text nodes
   * whose content contains the ${externalDocsUrl} placeholder.
   *
   * The NodeFilter callback rejects text inside non-rendered elements
   * (script, style, template, noscript) and skips text already inside
   * an <a> element (at any nesting depth), then applies a cheap
   * substring check (includes) rather than the full regex.  Any false
   * positives (e.g. the placeholder without a valid trailing path)
   * are harmlessly handled downstream by buildFragmentFromMatches
   * returning null.
   */
  function collectMatchingNodes(scopes) {
    const nodes = [];
    /* Guard against processing a node twice when code view selectors
       produce overlapping containers (e.g. .highlight inside .blob-wrapper). */
    const seen = new Set();
    for (const scope of scopes) {
      const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) =>
          /* REJECT and SKIP are equivalent for text nodes (they are leaves) */
          NON_RENDERED_TAGS.has(node.parentElement?.tagName)
            ? NodeFilter.FILTER_REJECT
            : node.parentElement?.closest('a')
              ? NodeFilter.FILTER_SKIP
              : node.nodeValue.includes(PLACEHOLDER)
                ? NodeFilter.FILTER_ACCEPT
                : NodeFilter.FILTER_SKIP,
      });
      while (walker.nextNode()) {
        if (!seen.has(walker.currentNode)) {
          seen.add(walker.currentNode);
          nodes.push(walker.currentNode);
        }
      }
    }
    return nodes;
  }

  /**
   * Registry of injected link elements. Populated by createDocsLink
   * and used by the document-level click/mousemove handlers to
   * detect interactions via coordinate hit-testing.
   */
  const injectedLinks = [];

  /**
   * Create a styled <a> element that opens the given URL in a new tab.
   *
   * The element is inserted into the visible code layer for display
   * purposes and registered in injectedLinks for coordinate-based
   * click detection. Direct click handlers are not relied upon
   * because GitHub's overlays intercept pointer events before
   * they reach the code layer.
   */
  function createDocsLink(url) {
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = url;
    link.style.cssText = 'color: var(--fgColor-accent, var(--color-accent-fg, #1f6feb)); text-decoration: underline;';
    injectedLinks.push({ element: link, url: url });
    return link;
  }

  /**
   * Normalize a captured URL path: decode first to collapse any
   * pre-encoded characters (e.g. %20), then re-encode via encodeURI
   * to produce a clean URL without double-encoding. Falls back to
   * the raw path if decodeURI throws (e.g. malformed %GG sequences).
   */
  function sanitizePath(raw) {
    try {
      return encodeURI(decodeURI(raw));
    } catch {
      return raw;
    }
  }

  /**
   * Build a DocumentFragment by splitting text on placeholder matches
   * and interleaving plain text segments with clickable documentation links.
   *
   * Uses matchAll for stateless iteration over all occurrences:
   *   1. Appends any plain text before the match.
   *   2. Sanitizes the captured path and constructs the full docs URL.
   *   3. Validates the URL; if invalid, keeps the original text.
   *   4. Appends a clickable link element for valid URLs.
   *   5. Appends any trailing text after the last match.
   *
   * Returns null if no matches were found, signalling to the caller
   * that no replacement is needed.
   */
  function buildFragmentFromMatches(text) {
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    let matched = false;

    for (const match of text.matchAll(PLACEHOLDER_PATTERN)) {
      matched = true;
      if (match.index > lastIndex) {
        fragment.append(text.slice(lastIndex, match.index));
      }
      const path = match[1];
      const url = DOCS_BASE_URL + sanitizePath(path);
      try {
        new URL(url);
        fragment.appendChild(createDocsLink(url));
      } catch {
        console.warn(
          'externalDocsUrl bookmarklet: sanitization produced an invalid URL, skipping.\n' +
          '  Original:  ' + JSON.stringify(match[0]) + '\n' +
          '  Sanitized: ' + JSON.stringify(url)
        );
        fragment.append(match[0]);
      }
      lastIndex = match.index + match[0].length;
    }

    if (!matched) return null;

    if (lastIndex < text.length) {
      fragment.append(text.slice(lastIndex));
    }
    return fragment;
  }

  /**
   * Check whether a point (x, y) in viewport coordinates falls
   * within any injected link's bounding rectangle. Returns the
   * URL of the first matching link, or null if none match.
   * Queries getBoundingClientRect live on each call so that
   * scroll, resize, and layout changes are handled automatically.
   */
  function findLinkAtPoint(x, y) {
    for (const entry of injectedLinks) {
      if (!entry.element.isConnected) continue;
      const rect = entry.element.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return entry.url;
      }
    }
    return null;
  }

  /**
   * Install document-level handlers for click and mousemove that
   * delegate to injected links via coordinate hit-testing.
   *
   * Click handler: if the click falls on an injected link, opens
   * the URL in a new tab. Uses the capturing phase so it fires
   * before GitHub's own handlers can consume the event.
   *
   * Mousemove handler: toggles a pointer cursor on the topmost
   * element at the mouse position when hovering over a link,
   * restoring the original cursor when moving away.
   */
  function installDelegatedHandlers() {
    let lastCursorTarget = null;
    let savedCursor = '';

    document.addEventListener('click', (e) => {
      const url = findLinkAtPoint(e.clientX, e.clientY);
      if (url) {
        e.preventDefault();
        e.stopPropagation();
        window.open(url, '_blank', 'noopener');
      }
    }, true);

    document.addEventListener('mousemove', (e) => {
      const url = findLinkAtPoint(e.clientX, e.clientY);
      const topEl = document.elementFromPoint(e.clientX, e.clientY);
      if (url && topEl) {
        if (lastCursorTarget !== topEl) {
          if (lastCursorTarget) lastCursorTarget.style.cursor = savedCursor;
          savedCursor = topEl.style.cursor;
          topEl.style.cursor = 'pointer';
          lastCursorTarget = topEl;
        }
      } else if (lastCursorTarget) {
        lastCursorTarget.style.cursor = savedCursor;
        lastCursorTarget = null;
        savedCursor = '';
      }
    });
  }

  /**
   * Replace placeholder text in a single DOM text node with clickable links.
   *
   * Skips the node if it has been detached from the DOM (which can
   * happen if overlapping scopes cause a parent to be replaced first).
   * Delegates to buildFragmentFromMatches to split the text and produce
   * a DocumentFragment of interleaved text nodes and link elements,
   * then swaps the original text node for the fragment.
   *
   * Returns true if a replacement was made, false otherwise.
   *
   * Any error on an individual node is caught and logged so that
   * remaining nodes can still be processed.
   */
  function replaceTextNodeWithDocsLinks(node) {
    try {
      if (!node.parentNode) return false;
      const fragment = buildFragmentFromMatches(node.nodeValue);
      if (!fragment) return false;
      node.parentNode.replaceChild(fragment, node);
      return true;
    } catch (nodeErr) {
      console.warn('externalDocsUrl bookmarklet: skipping node:', nodeErr);
      return false;
    }
  }

  /**
   * Main entry point: guard against duplicate runs, then find and
   * replace all ${externalDocsUrl}/[path] placeholders with clickable
   * documentation links.
   */
  function resolveExternalDocsUrls() {
    if (window.__externalDocsUrlBookmarkletRan === location.href) { return; }
    window.__externalDocsUrlBookmarkletRan = location.href;

    const containers = findCodeContainers();
    const nodes = collectMatchingNodes(containers);
    let replaced = 0;
    for (const node of nodes) {
      if (replaceTextNodeWithDocsLinks(node)) replaced++;
    }
    if (replaced > 0) {
      installDelegatedHandlers();
    }
    console.log(
      'externalDocsUrl bookmarklet: replaced ' + replaced + ' occurrence(s) on\n' +
      '  ' + location.href
    );
  }

  try {
    resolveExternalDocsUrls();
  } catch (err) {
    console.error('externalDocsUrl bookmarklet error:', err);
  }
})();
