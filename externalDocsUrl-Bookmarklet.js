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
   * inside <script> tags for SPA hydration.
   */
  const NON_RENDERED_TAGS = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT']);

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
   * Create a styled <a> element that opens the given URL in a new tab.
   *
   * GitHub's code view attaches click handlers to code containers
   * (for line selection, blame, etc.) that would intercept normal
   * link clicks. stopPropagation prevents those handlers from firing,
   * and the explicit window.open ensures reliable new-tab navigation
   * regardless of GitHub's SPA router.
   */
  function createDocsLink(url) {
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = url;
    link.style.cssText = 'color: var(--fgColor-accent, var(--color-accent-fg, #1f6feb)); text-decoration: underline; cursor: pointer;';
    link.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      window.open(url, '_blank', 'noopener');
    }, true);
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

    const nodes = collectMatchingNodes(findCodeContainers());
    let replaced = 0;
    for (const node of nodes) {
      if (replaceTextNodeWithDocsLinks(node)) replaced++;
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
