# Networking and electrical design document library

This repository publishes a GitHub Pages site for sharing plans, analyses, and raw supporting files.

## How it works

- Put any shareable files inside `documents/`.
- Keep custom site code inside `viewer/`.
- Push to `main`.
- GitHub Actions rebuilds the site and republishes GitHub Pages.

## Local preview

```bash
python3 scripts/build_site.py
python3 -m http.server 8000 --directory dist
```

Then open `http://localhost:8000`.

## Adding more files

- Preserve whatever subfolder structure you want inside `documents/`.
- The manifest is regenerated automatically during deployment.
- Supported inline previews include HTML, SVG, PDF, images, audio, video, Markdown, text/code files, CSV/TSV, and common Office formats where the browser can embed them.
