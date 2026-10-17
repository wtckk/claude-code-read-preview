# read-preview

A Claude Code mod that shows a thumbnail of every image Claude reads with the
`Read` tool, in the transcript, right under the read. Scroll up and each picture
is still where it was read.

## Install

In Claude Code:

```
/plugin marketplace add wtckk/claude-code-read-preview
/plugin install read-preview@read-preview
```

Then restart Claude Code.

## Requirements

- Claude Code 2.1.291 or newer
- A terminal that supports the kitty graphics protocol (kitty, Ghostty). Elsewhere
  you see the file name instead of the picture.
- ImageMagick (`magick` on PATH), used to shrink the picture for the preview.

## How it works

Reading png, jpg, gif, webp, bmp or tiff files converts them to an 800 px PNG under
`/tmp/read-preview/`. The mod draws that PNG under the read in the transcript. Runs
of folded reads that hold a picture are unfolded so the picture shows. Nothing is
sent over the network.

## License

MIT
