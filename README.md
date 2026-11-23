# holiday photobooth

two screens for one party:

- **`/`** — the photobooth. three photos on a countdown, laid into a 2x6in strip
  with a frame, a filter, stickers and a caption, saved straight to the guest's
  phone. works in mobile and desktop browsers, nothing leaves the device.
- **`/invite`** — the thing on the tv. an ascii christmas tree that tilts over
  and lands as a scannable qr code pointing at the booth.

## running it

```bash
npm install
npm run dev
```

the booth needs a **secure context** for the camera. `localhost` counts; a plain
`http://192.168.x.x` address on your phone does not, so test on a device either
through the deployed url or a tunnel (`npx localtunnel --port 5173`).

```bash
npm run build          # production bundle
npm run typecheck      # tsc
npm run verify:invite  # proves the tree's overhead view is exactly the qr code
```

## deploying

push to github and import the repo on vercel — it is a plain vite app, the
defaults are right (`npm run build`, output `dist`). `vercel.json` already
rewrites every path to `index.html` so `/invite` loads on a hard refresh.

then set one environment variable in the vercel project so the invite encodes
the real address:

```
VITE_BOOTH_URL = https://your-project.vercel.app
```

redeploy after setting it — vite bakes env vars in at build time. you can always
override it for a test with `/invite?url=https://example.com`.

## the tv screen

open `/invite` fullscreen on the tv. it loops on its own: tree for six seconds,
tilts overhead into the qr for nine, tilts back.

- **click / space** — jump straight to the code (and back to auto)
- **↑ / ↓** — hold the code or hold the tree
- `/invite?view=code` or `?view=tree` — freeze one view, handy for a photo

the trick is honest geometry rather than two pictures swapped out. every glyph
is one point in 3d: its column is shared by both views, its height draws the
tree, and its depth is a dark module of the qr code. head-on you read the tree,
from directly above the heights collapse and the glyphs land exactly on the
code. the leftover modules that the tree does not need become the snowfall
around it. `npm run verify:invite` checks every dark module is covered, that no
light module is painted on, and that no part of the tree went missing.

## your own art

- **frames** — `public/frames/README.md` has the sizes and the manifest format.
  draw at 600x1800 png with transparency, drop it in, add a line to
  `manifest.json`. no code change.
- **stickers** — `public/stickers/README.md`. emoji stickers are built in; your
  own pngs sit alongside them.

## where things live

```
src/lib/strip.ts      strip measurements, the one place to change the layout
src/lib/render.ts     paints the strip: photos, frame art, caption, stickers
src/lib/filters.ts    the filter presets, with a pixel fallback for old safari
src/booth/            camera, countdown, trays, the draggable sticker layer
src/invite/tree.ts    the ascii tree
src/invite/scene.ts   the dual projection that makes it also a qr code
scripts/verify-invite.ts
```
