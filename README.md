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
node scripts/make-stickers.mjs   # redraws every sticker and the border frame
```

## deploying

push to github and import the repo on vercel — it is a plain vite app, the
defaults are right (`npm run build`, output `dist`). `vercel.json` already
rewrites every path to `index.html`.

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

## the tree

the screen opens on it, so it is also what goes on the tv. it grows in from the
ground, turns on its own, and carries shaded baubles, a wound garland, a gold
star and a pile of wrapped presents at its foot.

- **tap** — the characters dissolve and the booth comes up
- **drag** — turn the tree; it holds still while you hold it
- **drag down** — tip the view up over the top of it
- **space** — stop or restart the spin
- **r** — reset the view and play the reveal again

it is not a sprite or a video. the tree is a lit 3d surface rasterised into a
character grid: every sample is shaded with a lambert term against one light,
projected with a perspective divide, and the nearest sample in each cell of the
grid picks the character from a brightness ramp. that is why the shaded side
fills with `.` and `-` while the lit side fills with `@` and `%`, and why a
bauble reads as a ball — each one is its own little sphere of samples.

on a phone the cone is drawn slimmer, the parcels pull in, the garland drops to
one strand and the grid is coarser, because a narrow screen is what caps how big
the tree can be drawn.

an earlier version had the tree tip over and land as a scannable qr code; it is
in the git history (`rebuild the invite as a volumetric ascii tree that flies
into formation as the qr code`) if you want it back.

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
src/invite/asciiTree.ts     the tree's geometry and the character-grid raster
scripts/make-stickers.mjs   draws every sticker and the border frame
```
