# externalDocsUrl Bookmarklet

A JavaScript bookmarklet that transforms `${externalDocsUrl}/[path]` placeholder strings on GitHub code view pages into clickable links pointing to the GitHub Enterprise Cloud documentation.

## What it does

When viewing source files on GitHub that contain URL references like:

```
${externalDocsUrl}/rest/actions/workflow-runs#force-cancel-a-workflow-run
```

this bookmarklet replaces them with clickable links that point to:

```
https://docs.github.com/en/enterprise-cloud@latest/rest/actions/workflow-runs#force-cancel-a-workflow-run
```

- Links open in a new tab.
- Clicking a link does not trigger GitHub's underlying code view handlers.
- Multiple occurrences on a single page are all replaced.
- A double-run guard prevents duplicate replacements if clicked more than once on the same page. The bookmarklet automatically re-enables itself when you navigate to a different page (including via GitHub's SPA navigation).
- Path characters are validated and sanitized before constructing URLs.
- Errors are logged to the browser console rather than failing silently.

## Installation

### Chrome

1. **Option A – via the Bookmarks Manager:** Open the Bookmarks Manager (`Ctrl+Shift+O` on Windows/Linux, `⌘+Shift+O` on macOS), click the **⋮** (three-dot) menu in the top-right corner, and select **Add new bookmark**.

   **Option B – via the bookmarks bar:** If your bookmarks bar is visible (toggle it with `Ctrl+Shift+B` on Windows/Linux or `⌘+Shift+B` on macOS), right-click the bar and select **Add page…**
2. Set the **Name** to something like `Resolve externalDocsUrl`
3. In the **URL** field, paste the entire bookmarklet code (the `javascript:(function(){ ... })();` string)
4. Click **Save**
5. Navigate to a GitHub code view page containing `${externalDocsUrl}` references and click the bookmark

### Firefox

1. Press `Ctrl+Shift+O` (Windows/Linux) or `⌘+Shift+O` (macOS) to open the **Library** (Bookmarks Manager)
2. Right-click on **Bookmarks Toolbar** (or any folder) and select **Add Bookmark…**
3. Set the **Name** to something like `Resolve externalDocsUrl`
4. In the **Location** (URL) field, paste the entire bookmarklet code (the `javascript:(function(){ ... })();` string)
5. Click **Save**
6. Navigate to a GitHub code view page containing `${externalDocsUrl}` references and click the bookmark

> **Note:** Firefox may strip the `javascript:` prefix when pasting into the Location field. If the bookmarklet doesn't work after saving, edit the bookmark and confirm the URL begins with `javascript:`.

## Troubleshooting

If the bookmarklet doesn't appear to do anything:

- **Refresh the page** and try again. The double-run guard prevents it from running twice on the same URL, but a page reload clears the guard.
- **Open the browser console** (F12 → Console) and look for any error messages prefixed with `externalDocsUrl bookmarklet error:`.
- Confirm the page contains raw `${externalDocsUrl}/...` text and not already-rendered links.
