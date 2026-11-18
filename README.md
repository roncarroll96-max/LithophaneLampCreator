# Lithophane Lamp Creator

Turn a photo into a 3D-printable lithophane ball lamp (STL). Everything runs in your browser;
photos never leave your computer.

See [APP-SPEC.md](APP-SPEC.md) for the full specification.

## Use it online
Open **<https://roncarroll96-max.github.io/LithophaneLampCreator/>** on a computer, tablet or phone.
Nothing to install, and your photos stay on your device.

## Run it on this PC
Double-click **start.bat**. It starts a tiny local web server and opens
<http://localhost:5178> in your browser. Close the black window to stop it.
(Needs Node.js, free from nodejs.org.)

## How to use
1. **Choose photo** (or drag one onto the preview). Automatic adjustments are applied.
2. **Photo** tab: fine-tune tone, position the photo, set how far around the ball it goes.
   The **Thickness** button above the preview shows the walls as a grey map; point at the ball to read the thickness in mm.
3. **Ball** tab: shape, size (Small 100 / Medium 150 / Large 200 mm), wall thickness, opening and collar.
4. **Markings** tab: carved (dark lines), raised, or off; line width; turn the pattern.
5. **Text** tab: add names, numbers or dates. Pick a font and style (carved, bright or raised),
   click the ball to place the text, then fine-tune size, bend and position.
6. **Export** tab: check the bed fit, pick a detail level, **Export ball STL**.
7. Print opening-down, with slicer supports for the curve just above the collar.

Work is auto-saved in the browser. **Save project** downloads a `.lithoproj` file
(photo + settings) you can reopen later or send to someone.

## For developers
- Plain HTML + JavaScript modules, no build step. Three.js is vendored in `vendor/three` and the
  text fonts (SIL Open Font License) in `vendor/fonts` (refresh both with `npm install && npm run vendor`).
- `js/core/` has no browser dependencies (shapes, lithophane field, mesh, STL) and is shared
  by the page, the export Web Worker and the tests.
- `npm test` runs the geometry tests (watertight shells, sizes, thickness range, STL format).
- To host: upload the folder (without `node_modules`) to any static host.
