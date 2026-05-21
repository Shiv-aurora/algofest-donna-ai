# Donna AI UI Replica

Pixel-accurate frontend replica of the design pack using React + Vite + Tailwind.

## Routes
- `/overview`
- `/today`
- `/assignments`
- `/calendar`

## Run
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
```

## Design Assets
Source references live in `deisgn-pack/` and are transformed into:
- local images in `public/images`
- route fragments in `src/fragments`

Re-generate from source HTML if needed:
```bash
npm run prepare:design
```

## Visual QA
Automated route screenshot capture + pixel diff against design-pack PNGs:
```bash
npm run qa:screens
```

Artifacts are written to:
- `artifacts/current`
- `artifacts/diff`
