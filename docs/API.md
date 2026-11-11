# export-kit — API reference

**Version 1.0.0.** **Get bytes and files off the device, in the browser.** One file, no build step, no dependencies. Works from `file://` and from GitHub Pages.

Generated from the source in this repository: every name, argument and
note below is read out of the kit file, so it cannot describe a function
that is not there.

```js
<script src="export-kit.js"></script>
Export.filter(...)
// or: const Export = require('./export-kit.js')
```

## The surface (13 entries)

| Name | Arguments | What it does |
|---|---|---|
| `Export.filter` | `(pred)` | — |
| `Export.sortBy` | `(key, dir)` | STABLE by construction, not by relying on the engine: equal elements keep the order they came in with, which is what makes a second sort meaningful. |
| `Export.groupBy` | `(key)` | — |
| `Export.sum` | `(key)` | { value, used, skipped } - an omission is REPORTED, never silent |
| `Export.mean` | `(key)` | — |
| `Export.min` | `(key)` | — |
| `Export.max` | `(key)` | — |
| `Export.count` | `()` | — |
| `Export.select` | `(keys)` | — |
| `Export.unique` | `(key)` | — |
| `Export.toCSV` | `()` | THE SPEC SAID to reuse export-kit's existing CSV code. There was nothing to reuse: the kit's `csv(name, csvText)` DOWNLOADS a csv, it does not serialise rows. So the other half of the round-trip had t |
| `Export.first` | `(n)` | — |
| `Export.last` | `(n)` | — |

## Notes

- Zero dependencies, one file, no build step: it works from `file://`, from a
  `<script>` tag and from Node.
- The version above is the `VERSION` file in this repository; a pinned copy is
  what an app vendors.
