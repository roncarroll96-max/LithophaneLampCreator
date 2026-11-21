# Lithophane Lamp Creator

Turn photos into 3D-printable lithophane lamps (STL): balls (basketball, soccer, football,
baseball/softball, volleyball, plain), a Moon, a cube with a photo on each side, flat panels, a
cylinder with a wide photo wrapped round it, or a lantern of 3 to 6 panels in a frame, plus a matching base for an LED puck, an LED strip or a bulb. Everything runs in your browser;
photos never leave your computer. Works on desktop, tablet and phone.

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
   Add up to 6 photos with **+ Add photo**; each goes on the next free side. Pick one in the list,
   then drag it on the ball to move it.
   A cut-out photo (transparent background, e.g. from your phone's "lift subject") works too:
   choose whether the empty area blends into the ball, glows bright or stays dark.
2. **Photo** tab: fine-tune tone, position the photo, set how far around the ball it goes.
   The **Thickness** button above the preview shows the walls as a grey map; point at the ball to read the thickness in mm.
   In the **Lit** view, the colour dots under the buttons change the colour of the light (white, warm white, yellow or amber). It only changes the preview.
3. **Shape** tab: shape (basketball, soccer, football, baseball/softball, volleyball, plain sphere, Moon, cube, cylinder),
   size (Small 100 / Medium 150 / Large 200 mm; footballs 160 × 100 / 240 × 150 / 280 × 175 mm),
   wall thickness, opening and collar. "Picture detail on the" puts the picture's bumps inside (smooth ball, the
   default) or outside (facing you, often crisper when lit); on a panel, back or front.
   For the football: tip shape, from oval to pointed.
   For the Moon: Moon only or Photo + Moon, crater depth, and turning the Moon.
   For the cube (5 photos): size, edge rounding, photo border, "Fit photos to faces", even glow.
   The cube STL comes out upside down, top face on the bed, ready to print without supports.
   For a **cylinder**: Small, Medium, Large or a custom diameter and height, and how far round the photo goes (all the
   way round, its ends fading into each other at the back, or a front window). It stands in a base like the balls'.
   For a **flat panel**: rectangle (match the photo, 4×6, 5×7, 8×10 in or custom), square, circle or heart;
   a curve slider; a raised frame; optional feet. Several photos can make a collage ("Arrange as collage").
   For a **lantern**: the number of sides (3, 4, 5 or 6), the panel size (4×6, 5×7, 8×10 in or square), pillar thickness, base height,
   slot and peg fit, and the top (like a Japanese lantern, a pagoda roof or a simple lid). Each photo fills one
   side; the Base tab takes your puck light's size, and whether it stands in a hole in the base's floor or sits
   in a tray (closed floor, a rim round the puck and a gap for the cord). **Theme: Christmas** gives the lantern a low or
   two-tier roof, a ring or star on top, and flat trim pieces (side frames, base strips, snowflakes or holly, lattice)
   to print in a second colour and glue on. The Export tab has a button for each panel, the pillar
   (print one per corner), the base and the top, each already turned for printing without supports.
   On the Base tab, choose a light box (with an LED strip), a slot stand or none. The panel STL stands
   on its bottom edge, ready to print without supports (use a brim).
4. **Markings** tab: carved (dark lines), raised, or off; line width; turn the pattern.
5. **Text** tab: add names, numbers or dates. Pick a font and style (carved, bright or raised),
   click the ball to place the text, then fine-tune size, bend and position.
6. **Base** tab: choose the light (LED puck, LED strip on a riser, or bulb socket), enter its size,
   adjust the collar fit, check that it fits your bed, and **Export base STL** (a separate file,
   already turned for printing).
7. **Export** tab: check the bed fit, pick a detail level (each shows its file size; very big files get a warning),
   **Export ball STL** (or **Export panel STL**), or **Export all parts as one 3MF**: the lamp and its base (or every lantern
   part) in one much smaller file, each part named and turned for printing. In your slicer, press Arrange to place them.
8. Print opening-down, with slicer supports for the curve just above the collar.

**Print tips** (link in the header, also on the Export and Base tabs) opens a page of slicer
settings that generally work well: 100% sparse infill, 3 to 4 wall loops, layer height, seam,
supports, how each file goes on the bed, the base, and troubleshooting.

Work is auto-saved in the browser. **Save project** downloads a `.lithoproj` file
(photo + settings) you can reopen later or send to someone.

## For developers
- Plain HTML + JavaScript modules, no build step. Three.js is vendored in `vendor/three` and the
  text fonts (SIL Open Font License) in `vendor/fonts` (refresh both with `npm install && npm run vendor`).
- `js/core/` has no browser dependencies (shapes, lithophane field, mesh, STL) and is shared
  by the page, the export Web Worker and the tests.
- `npm test` runs the geometry tests (watertight shells, sizes, thickness range, STL format).
- To host: upload the folder (without `node_modules`) to any static host.
