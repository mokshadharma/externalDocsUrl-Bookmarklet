javascript:(function () {
  /* Bookmarklet: Resolve externalDocsUrl links
   *
   * On GitHub code view pages, replaces occurrences of
   * ${externalDocsUrl}/[path] with clickable links pointing to
   * https://docs.github.com/en/enterprise-cloud@latest/[path]
   *
   * Links open in a new tab and do not trigger GitHub's
   * underlying code view click handlers.
   */

  /**
   * Find the GitHub code view containers to search within.
   *
   * Target GitHub code view containers:
   *   .blob-wrapper         — classic file view code container
   *   .highlight            — syntax-highlighted code block
   *   table.highlight       — table-based syntax-highlighted code block
   *   .react-code-lines     — React-based file view (newer GitHub UI)
   *   .react-blob-print-hide — React-based file view print layout
   * Falls back to document.body if none are found.
   */
  function findCodeContainers() {
    const containers = document.querySelectorAll(
      '.blob-wrapper, .highlight, table.highlight, .react-code-lines, .react-blob-print-hide'
    );
    return containers.length ? containers : [document.body];
  }

  /**
   * Walk the DOM within the given scopes and collect all text nodes
   * whose content matches the given pattern.
   */
  function collectMatchingNodes(scopes, pattern) {
    const nodes = [];
    scopes.forEach(function (scope) {
      const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, null);
      while (walker.nextNode()) {
        const nodeText = walker.currentNode.nodeValue;
        pattern.lastIndex = 0;
        if (nodeText && pattern.test(nodeText)) {
          nodes.push(walker.currentNode);
        }
      }
    });
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
    link.style.cssText = 'color: #1f6feb; text-decoration: underline; cursor: pointer;';
    link.addEventListener('click', function (e) {
      e.stopPropagation();
      e.preventDefault();
      window.open(url, '_blank', 'noopener');
    }, true);
    return link;
  }

  try {
    if (window.__externalDocsUrlBookmarkletRan === location.href) { return; }
    window.__externalDocsUrlBookmarkletRan = location.href;
    const docsBaseUrl = 'https://docs.github.com/en/enterprise-cloud@latest/';
    /*
     * Regex breakdown:
     *   \$\{externalDocsUrl\}  — literal ${externalDocsUrl} placeholder
     *   \/                     — literal / separator after the placeholder
     *   (                      — start capture group: the docs path
     *     [\w./#?&=%+~-]+      — one or more valid URL path characters:
     *                            \w = word chars (a-z, A-Z, 0-9, _)
     *                            .  = dot         /  = slash
     *                            #  = fragment     ?  = query
     *                            &  = ampersand    =  = equals
     *                            %  = percent-enc  +  = plus
     *                            ~  = tilde        -  = hyphen
     *   )                      — end capture group
     *   /g                     — global flag: match all occurrences
     *
     * The character class limits the match to standard URL characters,
     * preventing the regex from greedily consuming surrounding text
     * (such as closing quotes, parentheses, or whitespace) that is
     * not part of the URL path.
     */
    const placeholderPattern = /\$\{externalDocsUrl\}\/([\w./#?&=%+~-]+)/g;

    const scopes = findCodeContainers();
    const nodes = collectMatchingNodes(scopes, placeholderPattern);

    nodes.forEach(function (node) {
      try {
        if (!node.parentNode) { return; }
        if (node.parentNode.tagName === 'A') { return; }
        const text = node.nodeValue;
        const fragment = document.createDocumentFragment();
        let lastIndex = 0;
        let match;
        placeholderPattern.lastIndex = 0;
        while ((match = placeholderPattern.exec(text)) !== null) {
          if (match.index > lastIndex) {
            fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
          }
          const path = match[1];
          /* decodeURI normalizes any pre-encoded characters (e.g. %20)
             so that encodeURI can re-encode cleanly without double-encoding.
             If the path contains malformed percent-encoding (e.g. %GG),
             decodeURI throws a URIError; fall back to the raw path. */
          var safePath;
          try { safePath = encodeURI(decodeURI(path)); } catch (_) { safePath = path; }
          const url = docsBaseUrl + safePath;
          fragment.appendChild(createDocsLink(url));
          lastIndex = placeholderPattern.lastIndex;
        }
        if (lastIndex === 0) return;
        if (lastIndex < text.length) {
          fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
        }
        node.parentNode.replaceChild(fragment, node);
      } catch (nodeErr) {
        console.warn('externalDocsUrl bookmarklet: skipping node:', nodeErr);
      }
    });
  } catch (err) {
    console.error('externalDocsUrl bookmarklet error:', err);
  }
})();
