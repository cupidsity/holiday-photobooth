# your own stickers

emoji stickers are built in. for hand-drawn ones:

1. export a **PNG with transparency**, roughly square, 256-512px a side.
2. drop it here.
3. add it to `manifest.json`:

```json
{ "items": [{ "id": "my-sticker", "name": "my sticker", "src": "/stickers/my-sticker.png" }] }
```

they appear in the sticker tray alongside the emoji ones.
