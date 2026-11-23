# holiday photobooth

two screens for one party:

- **`/`** — the booth. three photos on a countdown, the strip drops out of the
  slot and develops, then you press flowers and sigils into it, set the look and
  save it. works in mobile and desktop browsers, nothing leaves the device.
- **`/invite`** — the thing on the tv. an ascii christmas tree with real depth
  that turns on its trunk, then tips overhead and lands as a scannable qr code
  pointing at the booth.

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
node scripts/make-stickers.mjs   # redraws every sticker and the border frame
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

## the strip

- **three exposures**, taken on a 3-2-1 countdown with a flash, stored raw so
  every look below stays changeable afterwards.
- **look** — a filter (cyanotype, noel, frost, cocoa, candy cane, noir,
  twinkle), plus two dials that ride on top of whichever one is chosen:
  **exposure** (how deep and contrasty the print is) and **paper** (how much
  grain, flecking and halation the film shows).
- **press** — stickers go *into* the print rather than on top of it: they are
  drawn with a lighten blend, under the frame art and under the grain, the way
  an object laid on photographic paper blocks the light and prints pale. three
  families, drawn in `scripts/make-stickers.mjs`: **sigil** (cybersigilism, long
  swept strands), **fine line** (tattoo-flash florals) and **pressed** (flat
  photogram silhouettes). **arrangements** drop a whole layout at once, and
  every piece stays draggable afterwards.
- **words** — the two caption lines, in a script or a serif.
- **paper** — the stock the strip is printed on. every one is dark, because a
  pale silhouette only reads when the paper is darker than it is.

the strip exports at 600x1800, a real 2x6in photobooth strip at 300dpi.

## the tv screen

open `/invite` fullscreen on the tv. it loops on its own: the tree turns on its
trunk for six seconds, tips overhead into the qr for nine, tips back.

- **click / space** — jump straight to the code (and back to auto)
- **↑ / ↓** — hold the code or hold the tree
- `/invite?view=code` or `?view=tree` — freeze one view, handy for a photo

the trick is honest geometry rather than two pictures swapped out. every glyph
is one point in 3d: its column is shared by both views, its height draws the
tree, and its depth is a dark module of the qr code. each glyph is pushed to
whichever dark module sits nearest the cone it would occupy if the tree were
solid, so the tree has real volume and can turn without smearing. the leftover
modules the tree does not need become the snow around it. head-on you read a
tree; from directly above the heights collapse and the glyphs land exactly on
the code. `npm run verify:invite` checks every dark module is covered, that no
light module is painted on, and that no part of the tree went missing.

## your own art

- **frames** — `public/frames/README.md` has the sizes and the manifest format.
  draw at 600x1800 png with transparency, drop it in, add a line to
  `manifest.json`. no code change. `pressed-border.svg` is generated, so delete
  it from the manifest once your own art is in.
- **stickers** — `public/stickers/README.md`. everything in there is generated
  by `scripts/make-stickers.mjs`; your own pngs sit alongside them in the same
  manifest.

## where things live

```
src/lib/strip.ts      strip measurements, the one place to change the layout
src/lib/render.ts     paints the strip: photos, pressed pieces, frame, caption
src/lib/filters.ts    the filter presets and the exposure dial
src/lib/paper.ts      grain, flecks, halation, vignette
src/booth/            camera, countdown, trays, arrangements, the sticker layer
src/invite/tree.ts    the ascii tree
src/invite/scene.ts   the dual projection that makes it also a qr code
scripts/make-stickers.mjs   draws every sticker and the border frame
scripts/verify-invite.ts    proves the overhead view scans
```
