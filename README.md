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

## Installation

### Chrome

1. Open the **Bookmarks Manager** (`Ctrl+Shift+O` on Windows/Linux, `⌘+Shift+O` on macOS), or right-click the bookmarks bar and select **Add page…**
2. Set the **Name** to something like `Resolve externalDocsUrl`
3. In the **URL** field, paste the entire bookmarklet code (the `javascript:(function(){ ... })();` string)
4. Click **Save**
5. Navigate to a GitHub code view page containing `${externalDocsUrl}` references and click the bookmark

> **Tip:** If you don't see the bookmarks bar, press `Ctrl+Shift+B` (Windows/Linux) or `⌘+Shift+B` (macOS) to toggle it.

### Firefox

1. Press `Ctrl+Shift+O` (Windows/Linux) or `⌘+Shift+O` (macOS) to open the **Library** (Bookmarks Manager)
2. Right-click on **Bookmarks Toolbar** (or any folder) and select **Add Bookmark…**
3. Set the **Name** to something like `Resolve externalDocsUrl`
4. In the **Location** (URL) field, paste the entire bookmarklet code (the `javascript:(function(){ ... })();` string)
5. Click **Save**
6. Navigate to a GitHub code view page containing `${externalDocsUrl}` references and click the bookmark

> **Note:** Firefox may strip the `javascript:` prefix when pasting into the Location field. If the bookmarklet doesn't work after saving, edit the bookmark and confirm the URL begins with `javascript:`.
