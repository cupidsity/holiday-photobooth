# dropping in your own frames

1. draw at **600 x 1800 px** (that is a real 2x6in photobooth strip at 300dpi)
   and export a **PNG with transparency** — anywhere you leave transparent is
   where the photos show through.
2. drop the file in this folder.
3. add an entry to `manifest.json`. it shows up in the booth on the next reload,
   no code change needed.

```json
{
  "id": "my-frame",
  "name": "my frame",
  "kind": "strip",
  "src": "/frames/my-frame.png",
  "background": "#f6efe2",
  "ink": "#1d3b2a"
}
```

- `kind: "strip"` — one piece of art laid over the whole strip.
- `kind: "photo"` — art stamped over **each** of the three photos. draw that one
  at **528 x 500 px** instead.
- `background` — the paper colour behind the photos (shows in the margins and
  the caption area).
- `ink` — the caption text colour, pick something readable on `background`.

the photos sit at x 36-564, with the three cells at y 36, 560 and 1084
(500px tall each). the caption area is the bottom 216px.

`garland.svg` and `lights.svg` are stand-ins so the picker is not empty — feel
free to delete them once your own art is in.
