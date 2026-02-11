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
  try {
    if (window.__externalDocsUrlBookmarkletRan === location.href) { return; }
    window.__externalDocsUrlBookmarkletRan = location.href;
    var base = 'https://docs.github.com/en/enterprise-cloud@latest/';
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
    var re = /\$\{externalDocsUrl\}\/([\w./#?&=%+~-]+)/g;
    /* find all code containers, or fall back to body */
    var scopes = document.querySelectorAll('.blob-wrapper, .highlight, table.highlight, .react-code-lines, .react-blob-print-hide');
    if (!scopes.length) { scopes = [document.body]; }
    var nodes = [];
    scopes.forEach(function (scope) {
      var walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, null, false);
      while (walker.nextNode()) {
        var t = walker.currentNode.nodeValue;
        re.lastIndex = 0;
        if (t && re.test(t)) {
          nodes.push(walker.currentNode);
        }
      }
    });
    nodes.forEach(function (node) {
      try {
        if (node.parentNode && node.parentNode.tagName === 'A') { return; }
        var text = node.nodeValue;
        var frag = document.createDocumentFragment();
        var lastIndex = 0;
        var m;
        re.lastIndex = 0;
        while ((m = re.exec(text)) !== null) {
          if (m.index > lastIndex) {
            frag.appendChild(document.createTextNode(text.slice(lastIndex, m.index)));
          }
          var path = m[1];
          var url = base + encodeURI(decodeURI(path));
          var a = document.createElement('a');
          a.href = url;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.textContent = url;
          a.style.cssText = 'color: #1f6feb; text-decoration: underline; cursor: pointer;';
          a.addEventListener('click', function (u) { return function (e) {
            e.stopPropagation();
            e.preventDefault();
            window.open(u, '_blank', 'noopener');
          }; }(url), true);
          frag.appendChild(a);
          lastIndex = re.lastIndex;
        }
        if (lastIndex === 0) return;
        if (lastIndex < text.length) {
          frag.appendChild(document.createTextNode(text.slice(lastIndex)));
        }
        node.parentNode.replaceChild(frag, node);
      } catch (nodeErr) {
        console.warn('externalDocsUrl bookmarklet: skipping node:', nodeErr);
      }
    });
  } catch (err) {
    console.error('externalDocsUrl bookmarklet error:', err);
  }
})();
