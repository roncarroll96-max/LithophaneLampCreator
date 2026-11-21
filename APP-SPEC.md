# Lithophane Lamp Creator: Specification
_Interview date: 2026-11-18 · Status: Approved 2026-11-18 · Cube shape (feature 12a) added and approved 2026-11-18 · Version 1.0.0 released 2026-11-18 (AI photo tools moved to Later) · Flat panel (feature 12b, version 1.1) added and approved 2026-11-19 · Version 1.2 (speed) 2026-11-19 · Version 1.3 (picture detail on the outside or front) 2026-11-19 · Lantern (feature 12c, version 1.4) added and approved 2026-11-19 · Version 1.4.1 (light colour in the Lit view) 2026-11-20 · Version 1.4.2 (puck tray in the lantern base) 2026-11-20 · Version 1.5 (3MF export) 2026-11-20 · Version 1.6 (lanterns with 3 to 6 sides) 2026-11-20_

**Build order:** Milestone 1 = basketball + plain sphere with photo, carved/raised lines, opening and collar, lit preview, STL export → test print on the base → Milestone 2 = remaining shapes, multiple photos, cube, AI photo tools, text, base generator, phone polish.

**Version plan** (agreed 2026-11-18; each release gets a test print before the next):

| Version | Contents |
|---|---|
| 0.1.0 | Milestone 1 (done, tagged) |
| 0.2 | Print-quality tools: thickness view in the preview, SVGs always loaded at full resolution (0.2.1 removed the short-lived "photo detail on the outside" option) |
| 0.3 | Text |
| 0.4 | Soccer ball, baseball/softball, volleyball, Moon |
| 0.5 | Football |
| 0.6 | Several photos per ball |
| 0.7 | Cube with a photo on each of its 5 visible faces |
| 0.8 | Base generator and light riser |
| 0.9 | ~~AI photo tools~~ skipped for now (moved to Later, 2026-11-18). Cut-out photos made with a phone or Windows Photos already work (0.4.1). |
| 1.0 | Phone and tablet polish, final check against this spec (done) |
| 1.1 | Flat panel (feature 12b): square, rectangle, circle, heart; curve; frame; light-box base, slot stand and feet |
| 1.2 | Speed: faster tone sliders and Base tab, lighter big-base and Fine exports, 3D view pauses when idle (from the 1.0.3 review) (done) |
| 1.3 | "Picture detail on the" choice is back: inside or outside for balls and cubes, back or front for panels (done) |
| 1.4 | Lantern (feature 12c): 4 flat panels in a frame of pillars, a base with a puck light, and a choice of 3 tops (done) |
| 1.4.1 | Light colour in the Lit view: white, warm white, yellow or amber (done) |
| 1.4.2 | Lantern base: the puck can sit in a tray (closed floor, rim, gap for the cord) instead of a hole (done) |
| 1.5 | 3MF export: every part in one file (the lamp and its base, or all the lantern's parts), moved up from the Later list (done) |
| 1.6 | Lantern with 3, 4, 5 or 6 sides (done) |

## Purpose
Making lithophane ball lamps by hand (basketball, football, soccer ball with a photo that glows when lit from below) is slow and fiddly. This tool does it in one place: pick a photo, let it auto-adjust the photo for a lithophane, tweak with sliders, choose a ball shape, preview how it will look lit, and export a 3D-printable STL (plus a matching base).

**Success:** a photo goes from loaded to print-ready STL in a few minutes, and the print looks right on the base the first time, with no Photoshop, Blender or hand-wrapping.

## People and access
- **Users:** you and one offsite friend for now. Later it becomes a free public website, possibly ad-supported.
- **No sign-in or accounts.** Everyone sees the same tool.
- Photos are processed **entirely inside the user's browser** and never uploaded anywhere. This holds after it's hosted too.

## Features
### Must have (version 1)

**Photo**
1. **Load a photo** (JPG, PNG, WebP, HEIC if the browser supports it) by file picker or drag-and-drop.
2. **Crop and position**: zoom, pan, rotate the photo inside its window on the ball.
3. **Automatic adjustments on load**, each with an on/off switch and a slider afterward:
   - Auto levels + contrast (uses the full thickness range)
   - Sharpening
   - *(Background removal and face brightening with in-browser AI moved to Later on 2026-11-18. Photos already cut out elsewhere work: see "Cut-out photos" below.)*
4. **Manual tweaks**: brightness, contrast, gamma, sharpness, background fade amount, invert check. There's a before/after view and a "reset to auto" button.
5. **Photo coverage**: a slider from a small front window up to a full 360° wrap, with an adjustable soft edge where the photo fades into the plain ball surface.

**Multiple photos** (milestone 2)

5a. **Several photos on one ball, placed freely**: add photos one at a time; each appears in the list with a thumbnail. Select one to move it on the ball (drag in the 3D preview or use sliders), resize it, rotate it, and give it its own tone settings, window shape and soft edge. Reorder them (on top / below), hide, duplicate or remove. The first photo works exactly like version 1.

**Shapes**

6. **Basketball**: standard 8-panel line pattern.
7. **Soccer ball**: classic 32-panel pattern (pentagons and hexagons).
8. **Football**: lies on its side on the base (opening on the underside of the belly). Laces and end stripes.
9. **Baseball / softball**: curved double-stitch seam.
10. **Volleyball**: curved 3-strip panel lines.
11. **Plain sphere**: no markings.
12. **Moon**: craters and dark maria from free NASA moon maps bundled with the app. Two modes per project: moon only (classic moon lamp), or photo in a front window that fades into the moon surface.
12a. **Cube** (version 0.7): a cube lamp that sits on the same base as the balls.
    - **A photo on each of the 5 visible faces**: front, back, left, right and top. Each face's photo has its own tone, position, zoom and rotation settings (built on the several-photos work in 0.6).
    - **Plain border with a soft edge** around each photo, about 5 mm and adjustable, so nothing is cut off at a corner.
    - **A face with no photo** glows plain, using the same plain-brightness setting as the balls.
    - **Top photo** starts upright as seen from the front, and can be turned in 90° steps.
    - **Slightly rounded edges and corners** (about 5 mm). Photos stop before the curve.
    - **Sizes**: Small 80 mm, Medium 100 mm (default), Large 130 mm edge length, plus custom.
    - **Same opening and collar as the balls** (50 mm opening), so it fits your current base and any base the app makes.
    - **Even glow**: with one light at the bottom, the lower walls are brightest and the top face dimmest. The app makes the plastic slightly thinner the farther a spot is from the light, so the cube glows evenly. On/off switch and strength slider; the lit preview shows the result.
    - **Text** (from 0.3) can be placed on cube faces.
    - **Printed in one piece, upside down**: the top face lies flat on the bed and the four walls print straight up, the best direction for lithophane detail. The underside angles in toward the collar so it prints without supports. The top photo is printed lying flat, so it shows slightly less detail than the four walls.
    - Wall thickness, detail levels, preview modes, bed check, export and saving work the same as for the balls.

12b. **Flat panel** (version 1.1): a lithophane picture panel, the classic flat kind, as a new choice on the Shape tab.
    - **Shapes**: square, rectangle, circle or heart.
    - **Sizes**: rectangles 4×6, 5×7 and 8×10 inch; squares, circles and hearts 4, 6 and 8 inch; all with custom width and height. Sizes show both units, e.g. "5×7 in (127×178 mm)". A rectangle starts in the photo's own shape and orientation (portrait or landscape) so nothing is cropped; typing a size or picking a print size overrides it, and zoom and pan pick what shows.
    - **Curve slider**: starts flat; sliding it bends the panel side to side, like a section of a tall cylinder (left and right edges come toward you). Works for every shape.
    - **Raised frame** round the edge, following the shape (round for circles, heart-shaped for hearts): adjustable width, can be turned off. It makes the panel stiffer and hides the photo's edge.
    - **Front smooth, picture relief on the back** by default, the same rule as the lamps (smooth outside, relief inside). The frame stands out on the back too, so the front lies flat against a window or frame. Since 1.3 a "Picture detail on the: Back / Front" choice puts the picture and the frame on the front instead, with a flat back.
    - **Photos**: one photo fills the panel; up to 6 photos make a collage with soft edges, using the same multi-photo tools as the lamps. Tone, cut-out background, zoom, pan and drag work as on the lamps.
    - **Text**: names, dates or captions, placed by clicking on the panel.
    - **No markings** (the Markings tab says markings are for the ball shapes).
    - **Prints standing upright** on its bottom edge, the best direction for lithophane detail. Circles and hearts get a small flat on the bottom so they stand on the bed and sit in a base; the print tips suggest a brim for tall thin panels. The bed check uses the upright size.
    - **Optional feet** printed onto the bottom edge (off by default), so the panel stands by itself in a window or in front of a light. A curved panel can stand on its own without feet.
    - **Bases** (Base tab, separate files, like the lamp bases):
      - **Light box**: a rectangular base as wide as the panel, with a slot shaped to the panel's bottom edge (curved panels get a curved slot; circles and hearts sit in a short cradle). An LED strip inside shines up behind the panel. Designed for a common 10 mm USB LED strip, with adjustable strip width, slot fit and a cable notch. Prints without supports.
      - **Slot stand**: a small stand with a slot and no light, for a window or with a lamp behind.
    - **Even glow** (from the cube): with the light box, the bottom of the panel is nearest the light, so the app can make the plastic thinner higher up to even it out. On by default when the light box is chosen; strength slider.
    - Wall thickness, detail levels, preview modes, Thickness view, export, saving and project files work the same as for the lamps. The print tips page and both PDF guides get a panel section.

12c. **Lantern** (version 1.4): four flat lithophane panels, one on each side, held in a printed frame, inspired by the Japanese-style lantern in your photo (2026-11-19). A new choice on the Shape tab.
    - **Number of sides** (version 1.6, 2026-11-20): 3, 4, 5 or 6 panels; 4 to start, so earlier lanterns stay the same. Side 1 is the front and the others follow round to the right; with 4 sides they keep the names Front, Right, Back, Left. The pillars' outer faces continue the frame's, so a pillar is square for 4 sides and a rhombus for the others (shaped to the 60, 108 or 120 degree corners), with its slots at the right angle; the pegs have the pillar's shape, so a pillar can't turn. The base, the three tops (the pagoda roof becomes a 3-, 5- or 6-sided roof), the even glow, text placement, the preview, the export buttons and the 3MF all follow the number of sides. A photo set to a side the lantern no longer has is marked "Not shown". The app warns when the puck doesn't fit inside (a 4×6 triangle is only 44 mm across inside); the printer-fit checks show when a big lantern's base or top is too wide for the bed.
    - **One project, four photos**: the Photo tab shows four places, **Front, Right, Back, Left**, one photo each. Each photo has the usual tone, zoom, pan, cut-out and text tools. The 3D preview shows the whole lantern put together and lit, so you can turn it and see every side.
    - **Panels**: all four the same size. Rectangle (portrait or landscape: 4×6, 5×7, 8×10 in or custom) or square (4, 6, 8 in or custom). **4×6 in portrait to start.** Flat (no curve), no raised frame (the pillars, base and top hide the edges) and no feet. **Picture detail facing out** (the Front setting from 1.3), smooth back toward the light. Each panel prints standing up on its bottom edge, like a flat panel.
    - **Even glow** (from the cube and light box): the puck sits low in the middle, so the bottoms of the panels are nearest the light. The app makes the plastic thinner higher up to even it out. On by default at 50%, with a strength slider.
    - **Frame parts** (separate files, printed in any colour; a dark colour looks like your photo):
      - **Pillar** (one file, print 4): square, with a slot down two neighbouring faces at a right angle, so two panels meet at each corner. The slots stop short of each other, so the pillar stays one piece, and each panel edge goes about 6 mm in (never less than 4 mm: very thick panels get thicker pillars). A peg hole in its foot and a peg on its head (as built: a peg on the foot would leave the pillar standing on its peg, which can't be printed). It prints standing up on its foot when it fits the printer, and lying on an outer face when it's too tall.
      - **Base**: a frame round the bottom of the panels, with a groove each panel's bottom edge drops into and square pegs that stand up from its corners into the pillars' feet. Its corner blocks stand out a little past the pillars, like the feet in your photo. A thin floor on the table has a round hole for the **puck light** (70 × 20 mm until you measure yours; the Base tab has boxes for both): the puck sits on the table in the hole, so you lift the lantern off to switch it on or change its batteries. Or choose **Tray** (1.4.2): the floor is closed and a low rim (40% of the puck's height, 3 to 8 mm) holds the puck in the middle, with a gap at the back of the rim for the cord. A notch at the back lets a USB cable out.
      - **Top** (a choice of 3): **Like your photo**: a frame with crossed beams, short posts above the pillars, corner caps that stick out and an open lattice in the middle. **Pagoda roof**: a 45-degree four-sided roof whose eaves come down outside the frame, with vents in the frame under the eaves; a lower top leaves a square opening at the peak. **Simple lid**: a flat cap with a pattern of vent holes. Every top has holes for the pillar pegs and a groove that holds the panels' top edges. It lifts off.
    - **Putting it together**: push the pillars onto the base's pegs, slide the four panels down the slots into the base groove, then press the top onto the pillar pegs. Holds without glue and comes apart to swap panels; a drop of glue makes it permanent.
    - **Sizing**: everything follows the panel size and thickness. The slots and grooves are as wide as the panel (Thickest + 0.4 mm, so 3.4 mm by default) plus "Slot fit". A few sliders: **pillar thickness, base height, top height, top overhang, slot fit, peg fit.**
    - **Export**: separate buttons for each part: Front, Right, Back and Left panels, Pillar (print 4), Base, Top. Each part has its own size estimate and printer-fit check, and is laid out the way it should print, without supports.
    - Wall thickness, detail levels, preview modes, Thickness view, saving and project files work as for the other shapes. The print tips page and both PDF guides get a lantern section.

13. **Markings per design**: each marking set (lines, panels, laces, seams) can be **carved in** (thicker plastic, glows dark, smooth outside), **raised** (sticks out from the surface), or **off**. Line width and darkness are adjustable.
14. **Size presets** plus a custom size field. The football scales with the preset:

    | Preset | Ball diameter | Football (length × width) |
    |---|---|---|
    | Small | 100 mm | 160 × 100 mm |
    | **Medium (default)** | 150 mm | 240 × 150 mm |
    | Large | 200 mm | 280 × 175 mm |

    The cube has its own presets: Small 80, **Medium 100 (default)**, Large 130 mm edge length.
    The custom size and last-used preset are remembered.
14a. **Printer bed check**: a setting holds your bed size (default 256 × 256 × 256 mm). The app warns if a part won't fit. If a part only fits placed diagonally (the Large football does), it says "rotate 45° in your slicer".

**Text**

15. **Add text** (name, number, date): type it, pick from a few bundled fonts, set size, and place it on the ball. Several text items per ball. *(Details settled 2026-11-18 for version 0.3:)*
    - **Three styles per text item:** **carved** (thicker plastic, glows dark, smooth outside), **bright** (thinner plastic, glows lighter than around it) or **raised** (sticks out from the outside).
    - **Placing:** click the ball in the 3D preview to put the selected text there, then fine-tune with sliders: around the ball, up/down, rotate, size.
    - **Arc:** a bend slider curves the text up or down (like a name over a jersey number). Straight by default.
    - **Bright outline:** an optional thin glowing outline around each letter, so carved text reads over dark parts of a photo. Off by default.
    - **Basketball and other lines stop around text**, with a small gap, so text stays readable.
    - **Four bundled fonts**, one of each kind: varsity/jersey block, bold clean sans, script, classic serif (open-license, included with the app so it works offline).
    - Text items can be added, edited, duplicated, hidden and removed, and are saved in projects.

**Mounting and base**

16. **Bottom opening + collar** on every shape, sized to fit the base. The opening diameter, collar height and fit clearance are adjustable.
17. **Base generator**: exports a separate printable base STL. Three light types, default **round LED puck**:
    - Round LED puck: enter the puck's diameter and height
    - LED strip / ring: enter its size; the base gets a channel and cable exit
    - E12 / E26 bulb socket: enter the socket size; a taller base with a cord exit
    All bases include a cable or switch notch and a seat that matches the ball's collar.
    - **Light riser** (optional): a post that lifts the light up toward the middle of the ball so a big ball lights evenly instead of bright at the bottom and dim at the top. It's on by default for Large and must pass through the 50 mm opening.

**Preview and export**

18. **3D preview** (rotate and zoom) with a toggle between **simulated backlit glow** (roughly how it looks on the base), **plain grey model** (for checking shape and markings) and **thickness map** (white = thinnest, black = thickest, with a legend; pointing at the ball shows the wall thickness there in mm). *(Thickness map added in 0.2.)*
19. **Lithophane thickness settings**: minimum (brightest) and maximum (darkest) wall thickness.
20. **STL export** with a detail level chosen at export: **Draft / Standard / Fine**. Detail is the spacing between points on the photo side: Draft 0.5 mm, Standard 0.3 mm, Fine 0.2 mm (same for every size; the smooth outside uses 1 mm unless lines are raised). Measured sizes: Medium Standard ≈ 83 MB, Large Standard ≈ 150 MB, Medium Fine ≈ 178 MB; raised lines roughly double the file. It shows an estimated file size first. The ball and base export as separate files.
    - **3MF export** (version 1.5): one more button, **Export all parts as one 3MF**, puts every part in one file: the lamp and its base (just the panel when it has no base), or the lantern's 4 panels, 4 pillars, base and top. Each part is a named object, already turned for printing, set out side by side; the slicer's Arrange button sorts them onto plates. It uses the detail level chosen for the STL. Standard 3MF (core spec), so Elegoo Slicer, OrcaSlicer, Bambu Studio, PrusaSlicer and Cura all open it. The file is compressed: about a fifth the size of the STLs.
21. **Exported shells are watertight** (no holes or flipped faces), so slicers accept them without repair.

**Saving**

22. **Auto-save in the browser**: the current project is restored if the page is closed or refreshed.
23. **Save / Open project file**: downloads one file holding the photo and all settings. It can be reopened later or sent to your friend.

**Devices**

24. **Desktop, tablet and phone layouts.** On phones, choosing Fine export shows a warning that it may fail and suggests Standard, but still allows it.

### Later (not in version 1)
- AI photo tools: background removal or dimming, and face brightening, with in-browser models (skipped for now, 2026-11-18)
- Splitting the shell into two halves for support-free printing
- Customer-facing features on the hosted site (ads placement, help pages, sample gallery)
- More shapes (golf ball, tennis ball, hockey puck, custom-made shapes)

### Out of scope
- No accounts, sign-in or cloud storage of photos
- No server-side processing; the app is static files only
- No slicing or G-code. You slice in your own slicer
- No ordering or payments

## Data
- **Stored:** the current project (photo + settings) in the browser's own storage on that computer, plus project files you choose to save to your PC.
- **Defaults** you change (size, thickness, base light dimensions) are remembered in the browser.
- **Nothing leaves the computer.** There's no database and no server.
- **Bundled assets:** NASA moon height and color maps (public domain, downsized), open-license fonts. All are included with the app so it works offline.

## Rules and edge cases
- **Light vs. thickness:** brighter photo pixels = thinner plastic (min thickness); darker = thicker (max thickness). Defaults are 0.8 mm min, 3.0 mm max *(assumed)*.
- **Photo relief is on the inside** of the shell by default, so the outside stays smooth like a real ball. Only "raised" markings and text stick out *(assumed)*. Since 1.3 "Picture detail on the: Outside" presses the picture into the outer surface instead (same wall thickness, smooth inside). The collar band stays as it was, and a cube's top face keeps its detail inside because it prints face down on the bed.
- **Carved markings and text** use max thickness (or a set darkness) so they show dark when lit, layered over the photo.
- **Opening and collar** are kept clear of photo relief and markings so the ball seats cleanly.
- **Cube printing:** one piece printed upside down (top face on the bed), no supports. Thicknesses on the top face are built from flat layers, so very fine shading there is limited by layer height.
- **Cube even glow:** thinning for distance from the light never goes below the minimum thickness, so it can only brighten dim areas up to the brightest setting; with strength at 0 the cube is shaded by the photos alone.
- **Printing assumption:** one piece printed opening-down. The steep curve just above the opening needs slicer supports, so the app doesn't add any.
- **Cut-out photos** (PNG/WebP with a transparent background, e.g. from a phone's "lift subject" or Windows Photos' background removal): the transparent area shows as the chosen **Background**: **blend into the ball** (default; the plain ball or Moon carries on behind the subject, so no window edge shows), **bright** or **dark**, with an **edge softness** slider (default 2 mm). Automatic adjustments look only at the visible subject. The photo is kept as PNG so the transparency survives saving and reopening. *(0.4.1)*
- **SVG files** have no fixed pixel size, so they are always drawn at full working resolution (2400 px on the long side), whatever size the file lists. *(0.2)*
- **Very large or tiny photos:** large photos are scaled down to what the chosen detail level can use. Tiny photos show a "low resolution, may look blurry" warning.
- **Export too big for the device:** warn before starting. If the browser runs out of memory, show a clear message suggesting a lower detail level, not a silent crash.

## Screens and look
- **One main workspace:** 3D preview in the centre; controls in panels for Photo / Shape / Markings / Text / Base / Export. On phones the panels become tabs or a bottom sheet under the preview.
- **Dark showroom style:** dark background like your product photo so the glowing preview stands out, with warm amber accents.
- **Photo panel** shows the adjusted photo as a grey map (what becomes thickness) with a before/after toggle.

## Environment and deployment
- **Now:** runs locally on your Windows PC in Chrome. A `start.bat` launches a tiny local web server (Node is already installed) and opens the browser, because the app's background work (export) needs to be served that way rather than opened as a plain file. It works with no internet.
- **Your friend (before hosting):** gets the folder and runs the same `start.bat` (needs Node installed), or waits for the hosted version.
- **Later:** the same files go on a free static host (GitHub Pages, Netlify or Cloudflare Pages). No server code, $0 hosting.
- **Technology:** a plain HTML/JavaScript web app; Three.js for 3D (bundled locally).

## Decisions
| Topic | Decision | Decided by |
|---|---|---|
| Users | You + one offsite friend; public free site later | You |
| Where it runs | Locally now, free static hosting later | You |
| Processing | Everything in the browser, photos never uploaded | Assumed (Claude's default) |
| Photo coverage | Adjustable from front window to full wrap | You |
| Markings | Carved, raised or off, per design | You |
| Auto-adjust | Levels/contrast and sharpen. Background and face AI tools moved to Later | You (AI skipped 2026-11-18) |
| Preview | Toggle lit glow / plain grey | You |
| Export detail | Draft / Standard / Fine chosen at export | You |
| Text | In version 1 (0.3) | You |
| Text styles | Carved (dark), bright (thinner) or raised, per text item | You |
| Text placing | Click the ball, then fine-tune with sliders | You |
| Text fonts | Varsity block, bold sans, script, serif | You |
| Text readability | Optional bright outline around letters, off by default | You |
| Text arc | Bend slider, straight by default | You |
| Lines under text | Lines stop around text with a small gap | You |
| Soccer look | Seam lines plus darker pentagons (classic black-and-white look), pentagon darkness slider down to none | You (2026-11-18) |
| Baseball / softball | Curved seam plus V-shaped stitches on both sides | You (2026-11-18) |
| Volleyball | Classic 18-panel: six groups of three strips, neighbours turned 90° | You (2026-11-18) |
| Moon look | NASA surface brightness map (dark maria, bright craters, as seen from Earth) plus a crater-depth slider from NASA's height map | You (2026-11-18) |
| Cut-out photo background | Blend into the ball by default; bright and dark also offered; edge softness slider | You chose to add it (2026-11-18); default assumed (Claude's) |
| Text size default | Letters 15 mm tall; app warns below 6 mm (script below 10 mm) since thin strokes may not print | Assumed (Claude's default) |
| Football mounting | Lying on its side | You |
| Football stripes | Bright end stripes (thinner plastic, glow lighter), with a switch to turn them off | You (2026-11-18) |
| Football tips | Like a real football by default (fuller middle, tapered ends, rounded enough at the tip to print); tip sharpness slider | You (2026-11-18) |
| Football laces | On top as it lies on the base; photo on the side facing you | You (2026-11-18) |
| Overhang | Slicer supports; one-piece shell | You |
| Base | App generates a base; puck (default), LED ring/strip, bulb socket | You |
| Saving | Browser auto-save + project files | You |
| Shapes | Basketball, soccer, football, baseball, volleyball, plain sphere, Moon, cube | You (cube added 2026-11-18) |
| Cube: when | Version 0.7, after several photos per ball | You |
| Cube: printing | One piece, upside down (top face on the bed), no supports | You |
| Cube: edges | Slightly rounded, about 5 mm | You |
| Cube: photo framing | Plain border about 5 mm with a soft edge, adjustable | You |
| Cube: sizes | 80 / 100 / 130 mm edge, Medium 100 default, plus custom | You |
| Cube: base fit | Same 50 mm opening and collar as the balls | You |
| Cube: empty face | Plain glow at the plain-brightness setting | You |
| Cube: extras | Text on faces only; no wrap-around photo, no copy-to-all button | You |
| Cube: even glow | On by default, with on/off and strength slider | You |
| Cube: top photo | Upright as seen from the front, turn in 90° steps | You |
| Cube: underside | Angles in toward the collar so it prints without supports; exact shape settled during the build | Assumed (Claude's default) |
| Cube: border and corner sizes | 5 mm border, 5 mm edge rounding | Assumed (Claude's default) |
| Moon | Moon only or photo blended, per project | You |
| Photos per ball | Several, placed freely (milestone 2); was one | You (changed 2026-11-18) |
| Overlapping photos | The photo on top wins, with its soft edge blending into the one below | You (2026-11-18) |
| Photos per ball (max) | Up to 6 | You (2026-11-18) |
| Moving a photo | Drag it on the ball in the 3D preview (dragging elsewhere turns the view), plus sliders | You (2026-11-18) |
| New photo position | Next free side: back, then left, right, top | You (2026-11-18) |
| Settings per photo | Each photo has its own tone adjustments, size, position and window shape | Assumed (Claude's default) |
| Devices | Desktop, tablet and phone | You |
| Phone exports | Warn about Fine, but allow | You |
| Look | Dark showroom style, amber accents | You |
| Priority | Print quality first | You |
| Sizes | Small / Medium / Large presets (100 / 150 / 200 mm balls), Medium default, plus custom | You |
| Printer bed | 256 × 256 × 256 mm, with a fit warning | You |
| Large football | 280 × 175 mm, printed diagonally on the bed | Assumed (Claude's default) |
| Light riser | Part of the "LED strip on a riser" base: a hollow post you wrap an LED strip around, rising toward the middle of the lamp (a puck can't pass through the 50 mm opening) | You chose the three light types (2026-11-18); riser design assumed (Claude's) |
| Base light types | LED puck (default), LED strip on a riser, bulb socket (E12 / E26) | You (2026-11-18) |
| Base shape | Matches the lamp: round under balls and the Moon, square under the cube | You (2026-11-18) |
| Base openings | A cable notch only (your puck's button is on the cable or remote) | You (2026-11-18) |
| Puck size (until measured) | 70 × 20 mm | You (measure later) |
| Print time | Not a concern; quality over speed | You |
| Opening / collar | 50 mm opening, 5 mm collar | You |
| Printing | White PLA, 0.4 mm nozzle, opening-down | Assumed (you accepted defaults) |
| Thickness | 0.8 mm min, 3.0 mm max | Assumed (you accepted defaults) |
| Relief side | Inside (smooth outside) by default; an "Outside" choice is offered again since 1.3. It was tried in 0.2.0 and removed in 0.2.1, then brought back after you saw how crisp a print looks with the detail facing you | You (2026-11-18, changed 2026-11-19) |
| Collar wall | 2 mm (opening 50 mm inside, 54 mm outside) | Assumed (Claude's default) |
| Plain band above collar | First 4 mm of the ball above the collar kept plain (no photo or lines), blending in over 6 mm | Assumed (Claude's default) |
| Carved line darkness | Lines go up to 0.4 mm past the thickest setting so they show over dark photo areas | Assumed (Claude's default) |
| Markings over photos | Hidden under photos by default ("Hide lines under photos" 100%, fading back in at the photo's soft edge); the slider can let them show through. Projects saved at the old 30% default switch to hidden | You (2026-11-19) |
| Basketball line angle | Default turn: spin 60°, tilt 20°; adjustable | Assumed (Claude's guess, check on print) |
| Line width | Automatic = 2% of ball size (3 mm on Medium) | Assumed (Claude's default) |
| Detail presets | Draft 0.5 / Standard 0.3 / Fine 0.2 mm for all sizes | Assumed (Claude's default) |
| Local address | http://localhost:5178 via start.bat | Assumed (Claude's default) |
| Local launcher | `start.bat` + tiny local server | Assumed (Claude's default) |
| Flat panel shapes | Square, rectangle, circle, heart | You (2026-11-19) |
| Panel sizes | Photo print sizes: 4×6, 5×7, 8×10 in; squares/circles/hearts 4, 6, 8 in; custom | You (2026-11-19) |
| Rectangle shape | Starts matching the photo, can be overridden | You (2026-11-19) |
| Panel curve | Slider from flat to curved, bending side to side | You (2026-11-19) |
| Panel frame | Raised, adjustable width, can be turned off | You (2026-11-19) |
| Panel display | Light-box base with LED strip, optional feet, simple slot stand | You (2026-11-19) |
| Light-box base | One plain rectangular base for every panel shape, slot follows the panel's bottom | You (2026-11-19) |
| Panel photos and text | Up to 6 photos (collage) and text | You (2026-11-19) |
| Main use | Gifts and night lights, so the light box and frame matter most | You accepted Claude's suggestion (2026-11-19) |
| LED strip | Designed for a common 10 mm USB strip; width adjustable | You accepted Claude's suggestion (2026-11-19) |
| Units | Inch print sizes shown with mm next to them | You accepted Claude's suggestion (2026-11-19) |
| Version order | Flat panel is 1.1; speed work becomes 1.2 | You (2026-11-19) |
| Panel relief side | Back by default (smooth front); "Front" offered since 1.3, which moves the frame to the front too and keeps the back flat | You (2026-11-19) |
| Cube top face with outside detail | Keeps its detail inside, so the face that prints on the bed stays flat | Assumed (Claude's default) |
| Lantern: what the app makes | One project with 4 photos; exports 4 panels plus the frame parts | You (2026-11-19) |
| Lantern: panel shapes | Rectangle and square, all four the same size, flat | You (2026-11-19) |
| Lantern: starting panel size | 4×6 in portrait | You (2026-11-19, accepted default) |
| Lantern: light | Puck light in a floor pocket, 70 × 20 mm until measured; lift the lantern to reach it; USB cable notch | You (2026-11-19) |
| Lantern: assembly | Pegs and holes, no glue needed; panels slide down from the top and the top lifts off | You (2026-11-19) |
| Lantern: where the pegs are | On the base (pointing up) and on each pillar's head; holes in the pillar's foot and under the top, so every pillar prints standing on a flat end | Assumed (Claude's default, found while building) |
| Lantern: panel picture side and frame | Picture detail facing out; no raised frame on the panels | You (2026-11-19) |
| Lantern: top styles | Like your photo, pagoda roof and simple lid, all in 1.4 | You (2026-11-19) |
| Lantern: base style | Like your photo: bottom frame, pillars run down as legs, puck on a floor inside | You (2026-11-19) |
| Lantern: export | A separate button per part (4 panels, pillar, base, top) | You (2026-11-19) |
| Lantern: adjustments | Pillar thickness, base height, top height, top overhang, slot fit, peg fit | You (2026-11-19) |
| Lantern: photos per side | One photo per side; collages per side later | You (2026-11-19, accepted default) |
| Lantern: version | 1.4 | You (2026-11-19) |
| Lantern: number of sides | 3 to 6, chosen on the Shape tab; 4 to start | You (2026-11-20) |
| Lantern sides: names | Front, Right, Back, Left for 4 sides; Front, Side 2 ... Side 6 for the others | Claude's, accepted by you (2026-11-20) |
| Lantern sides: pillars and pegs | Pillar outer faces continue the frame (square or rhombus); pegs take the pillar's shape so pillars can't turn. Pagoda frame 20 mm tall (was 16) with a small 45 degree brace under the eaves, eaves of under 3 mm left off, eave edges flattened 1.5 mm underneath; lid vent holes only where they fit whole | Assumed (Claude's, found while building: needed for clean, printable parts at every number of sides) |
| Lantern: printer | Fit checked against 256 × 256 × 256 mm; pillars lie down when too tall to stand | You (2026-11-19, accepted default) |
| Lantern: even glow | On by default at 50% (thinner higher up, as the puck sits low) | Assumed (Claude's default) |
| Lit view light colour | Four choices (white, warm white, yellow, amber), picked with colour dots under the view buttons; warm white is the default instead of amber. Remembered in the browser, not saved in projects, as it only changes the preview | You asked for white or yellowish (2026-11-20); the choices and default are Claude's |
| Lantern: pillar slots | One pillar file printed 4 times, slots on two neighbouring faces, panel edges about 6 mm deep in the slot | Assumed (Claude's default) |
| Lantern: print direction of frame parts | The app lays out each part to print without supports: pillars on their foot (or lying down when too tall), the base as it sits, the photo-style and pagoda tops as they sit (their overhangs are cut at 45 degrees), the lid upside down | Assumed (Claude's default) |
| Lantern: base feet | The base's corner blocks stand 3 mm out past the pillars, like feet, instead of the pillars running through the base | Assumed (Claude's default, found while building: simpler and prints without supports) |
| Lantern: puck | Sits on the table in a round hole in the base's floor, so the lantern lifts off it | Assumed (Claude's default) |
| 3MF: what goes in | Every shape: the lamp and its base in one file; the lantern's 7 parts in one file | You (2026-11-20) |
| 3MF: layout | All parts in one file, set out side by side; the slicer arranges them onto plates | You (2026-11-20) |
| 3MF: lantern pillars | Four copies in the file | You (2026-11-20) |
| 3MF: slicer | Elegoo Slicer (based on OrcaSlicer); the file is plain standard 3MF so other slicers open it too. The STL buttons stay | You use Elegoo Slicer (2026-11-20); standard format and keeping the STLs are Claude's |
| Lantern: puck tray | A choice on the Base tab: Hole in the floor (default, as before) or Tray (closed 2 mm floor, a rim 40% of the puck's height (3 to 8 mm) and 2 mm thick, 1 mm room round the puck, a gap in the rim at the back as wide as the cable notch) | You asked for the tray (2026-11-20); its sizes are Claude's |
| Lantern: text | Placed round the lantern by clicking it; raised text prints as carved, as on a panel | Assumed (Claude's default) |
| Panel print direction | Upright on its bottom edge; circles and hearts get a small flat; brim suggested | Assumed (Claude's default) |
| Panel feet | Optional, off by default | Assumed (Claude's default) |
| Panel even glow | On by default with the light box | Assumed (Claude's default) |
| Collage start | First photo fills the panel; later photos start as smaller windows to drag; an "Arrange as collage" button lays them out in a grid | Assumed (Claude's default) |
| Panel frame default | 6 mm wide, 2 mm thicker than the thickest wall | Assumed (Claude's default, check on print) |

## Open questions
- **Your current process and tools:** not yet described. Knowing which software and settings give you good prints today would help tune the defaults. (You)
- **Your puck light:** its diameter and height. The base uses 70 × 20 mm until you measure it (the Base tab has boxes for both). (You, ideally with calipers)
- **Football shape:** the default tip shape (60%) is a guess at a real football; check it against a real ball on the first football print and adjust the default if needed. (You, after first football print)
- **Cube underside:** the 45° funnel under the cube hangs about 20 mm below the bottom of the walls on the Medium cube (total height 125 mm with the collar). Check on the first cube print that it looks right sitting on your base. (You, at the cube test print)
- **Even glow for balls too?** The same distance correction could help Large balls. Decide after seeing it on the cube. (You, after 0.7)
- **Light-box light:** how even the glow is from a strip in the base, and whether the default even-glow strength is right. (You, at the first panel print)
- **Heart and circle on the bed:** whether the small flat on the bottom is enough for them to print upright without tipping, or whether they need a brim or a wider flat. (You, at the first heart/circle print)
- **Lantern peg and slot fit:** the default fit is a guess. Print the base and one pillar first and adjust "Peg fit" and "Slot fit" before printing everything. (You, at the first lantern print)
- **Lantern light:** whether one puck lights all four sides evenly enough, and whether the even-glow strength is right for it. (You, at the first lantern print)
- **File sizes:** measured (see feature 20). Still to confirm: does your slicer handle the Standard file comfortably? (You, at test print)

## How we'll know it works
1. Load one of your real photos, choose basketball, and get a print-ready STL in under 5 minutes with only light slider tweaking.
2. The exported STL opens in your slicer with no repair warnings, and the ball and base fit together on the first print.
3. Lit on the base, the face in the photo is clear and not too dark, and the basketball lines show as dark lines on the ball around the photo, but not across it (changed 2026-11-19).
4. Save a project, close the browser, reopen it, and continue exactly where you left off. Send the project file to your friend and it opens the same for them.
5. The Moon in moon-only mode shows recognisable maria and craters when lit.
6. On a phone, you can load a photo, adjust it, preview, and export at Standard.
7. A Medium cube with five different photos exports in one STL, prints upside down with no supports, sits on your current base, and glows evenly from bottom to top.
8. A 5×7 in flat panel from one of your photos prints standing up with no supports, drops into its light-box base, and glows with a clear, even picture. The same works for a curved panel and a 6 in heart.
9. A lantern with four 4×6 in panels: every part prints without supports and fits your printer. The pillars push into the base, the panels slide down the slots, and the top presses on and lifts off again. With the puck switched on, all four pictures glow clearly and evenly. Changing to 5×7 panels and the pagoda roof resizes everything, and it still fits together.

## Build progress

### Version 1.6: lanterns with 3 to 6 sides, done (2026-11-20)
Built: **Number of sides** (3, 4, 5, 6) at the top of the lantern's Panels section. The lantern code now works out every part from the number of sides: each side has its own direction, the panels sit far enough out that one slot stops 2.5 mm short of the next, the pillar is the corner's rhombus (a square for 4), and the base, tops, grooves, peg holes, cable notch (always through the back wall) and the tray's cord gap are placed side by side round the outline. Changes found while building: the pegs take the pillar's shape; the pagoda frame is 20 mm tall (16 before) with a small brace under the eaves; eaves under 3 mm are left off and the eave edge is flattened 1.5 mm underneath; the lid only has vent holes that fit whole. (Each of these avoided a thin sliver or knife edge that left holes in the mesh at slanted angles.) The 4-sided lantern keeps its sizes (pillar 16 mm, panels 6.2 mm into their slots, same pegs). Shape list: "Lantern (3–6 panels)". Project file names say "-6-sided" etc. when not 4.

Checks passed: all automated tests, with the lantern tests now run for 3, 4, 5 and 6 sides (sizes, slots, bridges and pegs for every pillar thickness, wall and slot fit; panels clear of the frame and held in front, below and above; snug pegs; every part closed and printable without supports; the preview frame; the strip, photos and glow; the tray and notch). Every top style was also meshed at every number of sides, several overhangs and heights. In the browser: 3 and 6 sides shown, the puck warning on a small triangle, side swaps and exports.

### Version 1.5: 3MF export, done (2026-11-20)
Built: **Export all parts as one 3MF** on the Export tab for every shape. The file is a ZIP holding the standard 3MF model, written and compressed part by part in the export worker (each part is built, written and let go before the next, to save memory). Part names: the shape (e.g. "Basketball", "Panel"), "Base", "Front panel" ... "Left panel", "Pillar" (4 copies), "Top (style)". Triangles with a repeated corner are left out, as 3MF requires. The part-building code moved from the export worker into js/core/exportParts.js, shared by the STL and 3MF exports.

Checks passed: 90 automated tests (4 new: the ZIP opens with correct checksums, names, closed parts, copies, everything on the bed and nothing overlapping; the layout; a full lantern 3MF with 7 objects and 10 placements, all closed; which parts go in for a ball and for a panel with no base). In the browser: a Draft lantern 3MF in 9 s (20 MB, about 118 MB as STLs) and a ball 3MF in 2 s (8.8 MB, about 46 MB as STL). **Elegoo Slicer 1.5.3** (its command-line reader) opened the lantern file with all 10 pieces closed ("manifold = yes") and the ball file with the ball and base, and kept the part names when it re-saved it.

### Version 1.4.2: puck tray in the lantern base, done (2026-11-20)
Built: on the lantern's Base tab, "Hole in the floor" or "Tray". The tray has a closed floor with a low rim round the puck (using the puck size you enter) and a gap in the rim at the back for the cord, lined up with the cable notch. The even glow allows for the puck sitting 2 mm higher.

Checks passed: 86 automated tests (1 new: closed floor under the puck, rim round it, gap at the back, floor whole under the gap, closed solid that prints without supports). In the browser: the choice switches and is kept after a reload, and the tray base exported at 127 × 127 × 30 mm.

### Version 1.4.1: light colour in the Lit view, done (2026-11-20)
Built: four colour dots under the Lit / Plain / Thickness buttons (shown only in the Lit view) change the colour of the light: White, Warm white (new default), Yellow, Amber (the old colour). The ball, collar, glow ring and the pool of light on the floor all follow it. The choice is remembered in this browser; it changes only the preview, not the files.

Checks passed: all automated tests; in the browser, all four colours change the preview, the choice survives a reload, the dots hide in Plain and Thickness, and the phone layout has no overlap or sideways scroll.

### Milestone 1: done (2026-11-18, git commit 278a773)
Built and tested: photo loading with automatic adjustments and tone sliders; photo placement and window settings; basketball and plain sphere; carved, raised or no lines; Small/Medium/Large sizes; opening and collar; Lit and Plain preview; STL export with detail choice, bed-fit check and plastic estimate; browser auto-save and project files; desktop and phone layouts.

Checks passed: 8 automated geometry tests; exported STLs re-read from raw coordinates came back closed with no bad triangles; export, reload/restore, project save/open and phone layout tested in the browser.

Not built yet (milestone 2): multiple photos placed freely; soccer ball, football, baseball, volleyball, Moon; background removal and face brightening; text; base generator and light riser.

### Version 0.2: done (2026-11-18)
Built: Thickness view in the preview (legend plus a readout of the wall thickness under the pointer); "Photo detail on the inside / outside" option on the Ball tab (outside uses fine detail on the outer surface and a smooth inner surface, same wall thickness, collar band unchanged; file size about the same); SVGs drawn at full resolution.

Checks passed: 10 automated tests (2 new: outside relief is watertight, keeps the wall thickness, leaves the collar edge unchanged and never goes past the ball size); in the browser, a 120 px SVG loaded with no low-resolution warning, the Thickness view showed 0.80 mm on white and 2.54 mm on a grey area, and an outside-relief export completed with the estimated size.

### Version 0.2.1: done (2026-11-18)
Removed the "Photo detail on the inside / outside" option at your request; photo detail is always on the inside. Saved projects that used Outside open as Inside.
"Plain ball brightness" now also shows the wall it makes in mm, e.g. "55% (1.79 mm)", matching the Thickness view readout.

### Version 1.4: lantern, done (2026-11-19)
Built (feature 12c): **Lantern (4 panels)** on the Shape tab.
- **Panels**: rectangle (4×6, 5×7, 8×10 in, portrait or landscape, or custom) or square (4, 6, 8 in or custom), all four the same, flat, no frame, picture detail facing out. The four panels are handled as one strip that folds round the lantern, so photos, text, the Thickness view and dragging work just as on a flat panel. Each panel exports on its own as a normal flat panel, standing on its bottom edge.
- **Photos**: one per side (Front, Right, Back, Left), up to 4; the Photo tab has a side picker that swaps photos between sides. Dragging a photo slides it within its side.
- **Frame**: pillars (one file, print 4), base and top, all sized from the panel size and thickness. Shape tab: pillar thickness, base height, slot fit, peg fit, top style (Like the photo, Pagoda roof, Simple lid), top height and overhang. Base tab: puck size, cable notch, even glow.
- **Preview**: the whole lantern put together and lit, frame and all (each part meshed once, the pillar copied to the corners: about half a second).
- **Export tab**: a button for each panel and each frame part, each with its own printer-fit check and a note on how it prints.

Checks passed: 85 automated tests (7 new: the slots hold the panels at least 4 mm deep and the pillar stays one piece for every pillar, wall and fit setting; every point of all four panels is clear of the frame for three sizes and all three tops, with pillar lips in front and groove floors and roofs above and below; pegs clear their holes by the fit and no more; every frame part is a closed solid with nothing needing supports beyond short bridges, including a tall pillar lying down; the preview frame matches the parts; the strip puts each photo on its own side, even glow thins the panels higher up, and a panel exports as a closed W × T × H solid; every top keeps a sensible height). In the browser: the lantern showed with all three tops, landscape and square panels; all seven files exported closed with no bad edges (four 102 × 152 mm panels at 11.8 MB Draft, the pillar 16 × 16 × 149 mm, the base 127 × 127 × 30 mm, the top 141 × 141 × 32 mm); swapping sides, dragging a photo, clicking to place text and switching to a ball and back all worked; the phone layout fits without sideways scrolling.

Not tried yet: a real print. Print the base and one pillar first to check the peg and slot fit.

### Version 1.3: picture detail on the outside or front, done (2026-11-19)
Brought back at your request, after a print looked crisper seen from the side the detail is on:
- **Balls and cubes**: Shape tab, Wall thickness, "Picture detail on the: Inside / Outside". Outside presses the picture into the outer surface; the inner surface is smooth (Thickest + 0.4 mm in); the wall thickness at every spot, and so the lit picture, is the same as Inside. Raised markings and text sit on top. The collar band is unchanged, so bases fit as before. A cube's top face keeps its detail inside, because the cube prints top face down and that face must stay flat on the bed.
- **Panels**: "Picture detail on the: Back / Front". Front puts the picture and the frame on the front and leaves the back flat. With a frame the edge sits exactly where it did, so stands and light boxes fit as before; without one the edge sits at the back of the slot.
- The fine detail spacing goes on whichever side has the picture, so file sizes stay about the same; the Export tab's size estimate follows.
- Projects saved before 1.3 open with the detail inside.

Checks passed: 78 automated tests (5 new: an outside-detail ball is watertight with or without raised lines, its collar edge is unchanged, the wall thickness is the same as inside detail, the inside is a smooth sphere and nothing goes past the ball size; an outside-detail cube is watertight, its sides are pressed in and its top face still lies flat on the bed; a front-picture panel, curved heart with and without a frame, is watertight with a flat back, the same thickness and, with a frame, the same edge; old projects open with the detail inside). In the browser: the ball's Plain view shows the picture pressed into the outside, the panel shows the picture and frame on the front, and Draft exports of a 200 mm basketball (61.9 MB, estimate 62 MB) and a curved 5×7 panel (16.8 MB, estimate 17 MB) came back closed with no bad edges.

### Version 1.2: speed, done (2026-11-19)
Faster and lighter, with the same results (no change to any STL the app makes):
- **Tone sliders**: while a slider moves, the app adjusts a small copy of the photo (about 600 px); the full picture follows when the slider stops and always before an export. Adjusting the photo takes about a tenth of the time (an 1800 px photo: 186 → 17 ms per step; 2400 px: 450 → 22 ms).
- **Base tab**: changing a base setting under a ball or cube rebuilds only the base, not the lamp's preview (on a panel the light box's strip and slot also steer even glow, so the panel still updates). The preview base uses a coarser grid when the base is very big.
- **3D view**: the surface is rebuilt only when the shape or raised parts change, not after every tone or photo change.
- **3D view pauses**: it draws only when something changes (a setting, or the view turning and gliding to a stop) instead of 60 times a second, saving battery and heat. The unused "snapshot" copy of each frame is gone.
- **Base export**: built one layer at a time and skipping empty space. The 250 mm ball's strip base takes 3.6 s instead of 10.8 s and about 60 MB of memory instead of about 470 MB; the biggest base (extra width 40, riser 200) about 110 MB instead of about 1.3 GB. Very big bases get a slightly coarser grid so they finish in seconds.
- **Ball and panel export**: the mesh is built in compact form (a 250 mm ball at Fine: about 200 MB of working memory instead of about 590 MB, and a third faster), and the file is handed over in pieces, so a 500 MB STL doesn't need one huge block of memory.
- **Markings stay out of photos** (your request): ball markings now stop at the photos by default and fade back in at a photo's soft edge. The Markings tab slider is now called "Hide lines under photos" (100% = hidden; lower it to let lines show through). Projects saved with the old 30% setting switch to hidden; a value you picked yourself is kept.
- **Big-file warning**: based on the estimated file size instead of the screen size, so iPads and other tablets see it too (touch screens above about 150 MB, computers above about 400 MB).

Checks passed: 73 automated tests (2 for the markings: inside a photo only the photo sets the thickness, and at 30% the lines show again; old projects at 30% switch to hidden while a chosen value is kept. 4 for speed: the faster base mesher gives exactly the same mesh as before; very big bases get a coarser grid; an STL written in pieces is byte for byte the same file; the small photo copy keeps the picture and its shape). Every base type (puck, strip, bulb, football, panel light box flat/curved/heart, slot stand) compared to the old mesher at two grid sizes: identical. In the browser: the 3D view draws nothing while idle and settles a few seconds after turning; a Standard ball export (149.7 MB, size matches its triangle count) and a strip base export (66 MB, 3.9 s) worked; base changes rebuild just the base; the panel, its light box and the Thickness view work; the phone layout shows the size warning for Fine.

### Version 1.1: flat panel, done (2026-11-19)
Built (feature 12b): **Flat panel** on the Shape tab.
- **Shapes and sizes**: rectangle (Match photo, 4×6, 5×7, 8×10 in, custom; portrait or landscape follows the photo), square, circle and heart (4, 6, 8 in, custom). Sizes are shown in inches and mm. Circles have a flat 40% of their width on the bottom, hearts 16% (an 8 in heart has a 33 mm flat), so they stand up and sit in a slot.
- **Curve** from flat to 120°, bending side to side. **Raised frame** on the back (6 mm wide, 2 mm thicker than Thickest by default, with a 45° slope into the picture; can be turned off). **Feet** (off by default): two small blocks on the bottom edge.
- **Photos**: the first fills the panel (cropped to its shape; drag on the panel to slide it inside), later ones start as smaller windows to drag; **Arrange as collage** lays them out in the grid that best fits their shape. **Text** placed by clicking the panel; raised text isn't offered (the front stays smooth).
- **Bases** (Base tab): **Light box**, a block as wide as the panel with a slot that follows its bottom edge (curved for curved panels) and an open trough behind it whose floor leans 30° toward the panel for the LED strip (strip width adjustable, cable notch at the back); **Slot stand**; or **None**. Both bases print standing up with no supports. **Even glow** (on by default with the light box) thins the plastic higher up, away from the strip.
- **Export**: the panel stands on its bottom edge in the STL. Bed check uses the upright size. Tips page and both PDF guides have panel sections (supports off, brim on, how it goes on the bed).
- Shared code: the photo blending now lives in one place for lamps and panels (no change to lamp output; all lamp tests still pass).

Checks passed: 67 automated tests (6 new: rectangle sizes follow the photo; all four outlines are the right size and their rings never cross; the front stays flat while bright photo areas print thin, dark ones thick and the frame thickest; even glow thins the top only with the light box; panel meshes are closed, stand at z = 0 and are the right size, flat and curved, with feet; light box and slot stand are closed solids with a slot exactly the panel edge plus the fit, and "None" gives no base). In the browser: a wide photo made a landscape panel; a curved 6 in heart and its light box exported (152.7 × 18.2 × 116.8 mm panel, 174 × 42 × 24 mm base); text, collage, switching back to a ball (collar and base return) and the phone layout (no sideways scrolling on any tab) all worked.
Still to check on a real print: how even the light box glow looks, the slot fit, and whether hearts and circles stand on the bed with a brim.

### Version 1.0.3: fixes from an independent code review (2026-11-19)
An independent review of the whole app found that the geometry was solid. It also found a number of bugs and gaps around it, all now fixed:
- **Base in the preview:** no longer disappears after New, opening a project or clicking the selected size. The stand no longer leaks graphics memory as sliders move.
- **Cube photos:** a new or changed photo now fills its square face straight away (it used to follow the photo's shape until "Fit photos to faces").
- **Cube edge rounding:** can't go below the thickest wall plus 0.5 mm (3.5 mm at the default 3 mm). Tighter rounding made the inside wall fold over itself at the edges. Older projects with tighter rounding are raised automatically.
- **Moon:** export waits for the NASA maps (it used to export a plain ball if they hadn't loaded). A failed download shows one message and a "Try again" button instead of a message on every change.
- **New** asks first whenever there is work to lose (text, markings, Moon or other settings, not only photos). **Remove** on a photo has an Undo.
- **Limits:** the opening slider stops at the largest opening that fits the size. A size change that leaves the opening too big shrinks it with a message (a 60 mm ball used to fail). A tall strip riser is kept at least 5 mm below the inside of the lamp, with a note. The Base tab says whether the base fits your printer bed.
- **Messages:** "Run start.bat" only appears on the local copy; online it says to check the internet. Browsers too old to export, or without 3D graphics (WebGL), get a clear message instead of dead buttons. A damaged autosave or a failed project save gives a message.
- **Safety:** project files can only carry pictures stored inside them; links to websites are ignored, so a file can't make the app contact the internet. Damaged photo or text entries are skipped. The local server (start.bat) refuses paths outside the app folder and requests that don't come from this PC by name.
- **Phones:** the Open project button no longer filters by file type, so iPhones and iPads can pick .lithoproj files.
Speed work followed in 1.2. There's also a tiny crease where the cube's flat rim beside the collar meets the funnel (about 1 mm, unchanged by this release); check it on the first cube print.

### Version 1.0.2: printer setting tips page (2026-11-18)
A "Printer Setting Tips" page (tips.html) with slicer settings that generally work well: 100% sparse infill, 3-4 wall loops, 0.12 mm layers, seam at the back, Arachne, slower outer wall, supports (off for the cube), how each file goes on the bed, base settings (normal settings, dark opaque filament), nozzle and filament, a checklist and troubleshooting. Linked from "Print tips" in the header and from the Export and Base tabs; opens in a new tab so the app keeps your work. Checked on desktop and phone (no sideways scrolling; settings stack as cards on phones).

### Version 1.0.1: "Ball" tab renamed "Shape" (2026-11-18)
The tab holding the shape, size, wall thickness and opening is now called **Shape** (it covers the cube too). Earlier notes below still say "Ball tab".

### Version 1.0: phone and tablet polish, final check, done (2026-11-18)
Phone and tablet: every tab checked at 375 × 812 (phone) and 768 × 1024 (tablet): nothing runs off the side and every button, option and checkbox is at least 36 px tall (small buttons and option bars are 40 px on phones, checkboxes 22 px). On phones the photo list shows each name on its own line with the buttons underneath. Touch screens have no hover, so in the Thickness view a tap on the ball shows the thickness there. In phone mode the Fine-detail warning appears and a Standard export completes. New projects now keep your own defaults (printer bed, size, wall thickness, opening, cube and base settings, detail), as this spec asks.

**Final check against the features (version 1):**

| # | Feature | Status |
|---|---|---|
| 1 | Load a photo (JPG, PNG, WebP, HEIC where supported, SVG), file picker or drag-and-drop | Done |
| 2 | Zoom, pan, rotate inside the window | Done |
| 3 | Automatic adjustments on load | Done for levels/contrast and sharpening ("Auto adjust" re-applies them; sliders change them). AI background and face tools moved to Later |
| 4 | Manual tweaks, before/after ("Hold: original"), back to auto ("Auto adjust") | Done (no AI background fade, see 3) |
| 5 | Coverage from a small window to a full wrap, soft edge | Done |
| 5a | Several photos (up to 6), placed freely | Done (0.6) |
| 6-12 | Basketball, soccer, football, baseball/softball, volleyball, plain sphere, Moon | Done (0.1-0.5) |
| 12a | Cube with 5 face photos | Done (0.7) |
| 12b | Flat panel | Done (1.1) |
| 13 | Markings carved / raised / off, width and darkness | Done |
| 14, 14a | Size presets plus custom, remembered; printer bed check with "rotate 45°" | Done |
| 15 | Text | Done (0.3) |
| 16 | Opening and collar, adjustable; fit clearance | Done (clearance lives in the base's collar seat) |
| 17 | Base generator: puck, strip riser, bulb socket | Done (0.8) |
| 18 | 3D preview: lit, plain, thickness map | Done |
| 19 | Thinnest / thickest wall | Done |
| 20 | STL export with detail choice and size estimate; ball and base as separate files | Done |
| 21 | Watertight shells | Done (checked by the automated tests for every shape and base) |
| 22, 23 | Browser auto-save; project files (all photos) | Done |
| 24 | Desktop, tablet and phone layouts; Fine warning on phones | Done (checked in phone and tablet sizes on this PC) |

**"How we'll know it works":**

| # | Check | Status |
|---|---|---|
| 1 | Real photo to print-ready STL in under 5 minutes | Done in the app; your own timing still to confirm |
| 2 | STL opens with no repair warnings; ball and base fit first time | Shells are watertight (tests). Base fit: needs your first base print |
| 3 | Lit on the base: clear face, dark basketball lines | Seen on your two test prints (milestone 1) |
| 4 | Save, close, reopen and continue; project opens the same for your friend | Done (autosave and project files tested, including old single-photo projects) |
| 5 | Moon shows recognisable maria and craters when lit | Seen in the lit preview; needs a Moon print |
| 6 | On a phone: load, adjust, preview, export at Standard | Done in phone mode on this PC; a real phone is still to try (e.g. via GitHub Pages) |
| 7 | Medium cube with five photos: one STL, prints upside down without supports, sits on your base, glows evenly | STL and orientation done; needs a cube print |

What still needs a real print or a real phone: base fit (and your puck's real size), a cube, a football (tip shape), a Moon, and trying the app on your phone.

### Version 0.8: base generator, done (2026-11-18)
Built: a Base tab and a separate "Export base STL". Three light types:
- **LED puck** (default 70 × 20 mm until you measure yours): the puck goes in from below, light shines up through a hole nearly as wide as the opening. Prints upside down (top on the bed); the STL is already turned.
- **LED strip on a riser**: a hollow 30 mm post (adjustable, always narrower than the opening) rising to about the middle of the lamp, with a wire hole near its top; underneath, room for the strip's controller under a 45° ceiling. Prints standing up.
- **Bulb socket (E12 / E26)**: a 1/8" threaded-nipple hole through the top and room below for the nut and wiring; warns if the socket is wider than the opening. Prints upside down.
Every base has the collar seat (collar fit adjustable, 0.4 mm extra room by default), a cable notch at the back (width and height adjustable), extra width, and a shape that matches the lamp (round under balls and the Moon, square under the cube) or is set to round or square. The 3D preview now shows the real base under the lamp. Bases are built from solid shapes (new core/sdf.js) and meshed closed.

Checks passed: 56 automated tests (11 new: the mesher's size and volume; every light type under a ball, the cube and the football is a closed solid and turns over correctly; the collar seat, clearance and floor; puck cavity, light path and notch; riser width and height; round vs square). In the browser: the square base under the cube and the round base with the riser under the ball draw correctly; a bulb-base export took about half a second (84 × 84 × 36 mm, 16 MB).

To check on a print: the collar fit in the seat (tighter or looser), and your puck's real size.

### Version 0.7: cube, done (2026-11-18)
Built: "Cube (5 photos)" shape: 80 / 100 / 130 mm presets plus custom size, adjustable edge rounding (5 mm default), same 50 mm opening and collar. Underneath, a 45° funnel runs from the rounded bottom edges down to the opening; its slices are rounded squares that match the cube where they meet, so there are no flat ceilings to print. (Only about 1 mm of each bottom corner's rounding shows past the funnel: patches of 1-2 mm.) Photos on the cube use the new "Straight-on" (planar) projection, so they sit on the flat faces without distortion; new photos go front, back, left, right, top, each filling its face minus the "Photo border" (5 mm default), and "Fit photos to faces" re-places them in list order. The top photo is upright seen from the front. Even glow (on by default, strength 50%) thins the wall where less light from the base arrives and thickens it where more does; the lit preview uses the same light model for the cube. The exported cube STL is already turned upside down (top face on the bed).

Checks passed: 45 automated tests (5 new: body shape and no flat underside surfaces; watertight shell turned top-face-down; photos on a face without distortion; five face slots sized to the border; even glow direction, limits, and no light value for balls). In the browser: five photos landed on the five faces, letters upright, top photo upright seen from the front; export 100 × 100 × 125.1 mm with the flat top face on the bed, matching the bed-fit estimate.

To check on a print: how the funnel looks on your base, the even glow (top vs. bottom of the walls), and the 5 mm border.

### Version 0.6.1: version number in the header, done (2026-11-18)
The app's version shows next to its name (from js/version.js; a test keeps it equal to package.json).

### Version 0.6: several photos per ball, done (2026-11-18)
Built: up to 6 photos per ball, each with its own picture, tone, cut-out background, position in window, window size and shape, soft edge and projection. New photos go on the next free side (back, left, right, top with the new "Flat" projection, then front-right) and start on top of the list. The Photo tab lists the photos with thumbnails and ↑ / ↓ (front/back order), Hide, Copy and Remove; the selected photo's settings show below, with "Around the ball" and "Up / down" placement sliders and a separate "Plain ball" section. Where photos overlap the one higher in the list is in front and its soft edge fades into the one below (a cut-out set to "Blend in" floats on whatever is behind it). Drag the selected photo on the ball to move it; pressing anywhere else (including other photos) turns the view. Projects and the browser autosave keep every photo; projects saved by earlier versions open with their single photo.

Checks passed: 39 automated tests (6 new: two photos on opposite sides, overlap order, hidden and missing photos, a flat photo covering the top, starting sides and the 6-photo limit, older single-photo saves). In the browser: an autosave from 0.5 opened as one photo with its settings kept; two more photos went to the back and left with thumbnails; real mouse drags moved the selected photo without turning the view, and turned the view (without moving anything) when pressing on another photo; all three photos and their positions came back after a reload; a three-photo export completed.

### Version 0.5: football, done (2026-11-18)
Built: football body that tapers like a real ball (|x/a|^n + (y²+z²)/b² = 1, with a "Tip shape" slider from oval to pointed; the tip stays rounded, at least 10 mm radius, so the wall never folds over itself); lies on its side with the opening under its belly; four tip-to-tip seams, eight cross laces on top, and bright end stripes (switch on the Markings tab); length × width inputs on the Ball tab; the turn sliders are hidden for the football since its laces stay on top; football files are named by length × width. Also fixed: tabs no longer show a stray "null" where an optional section is left out.

Checks passed: 33 automated tests (5 new: the body matches its formula with outward normals and the right size; pointier tips taper more but stay printable; laces, seams and stripes in the right places with stripes switchable; watertight shells for pointed, raised-lace and plain footballs; stripes reach the thinnest wall). In the browser: the football draws with laces on top and stripes near both ends; Large shows "rotate it 45° in your slicer (280 × 175 mm)"; an export completed at 240 × 150 mm with no errors.

### Version 0.4.1: cut-out photos, done (2026-11-18)
Built: photos with transparent backgrounds are recognised; a "Background (cut-out photo)" section on the Photo tab chooses blend into ball / bright / dark plus edge softness; auto adjustments ignore the empty area; the grey map shows the background as it will print; the photo is stored as PNG when it has transparency.

Checks passed: 28 automated tests (4 new: each background choice, blend matching the plain ball with no window edge, edge softness, unchanged behaviour for normal photos). In the browser with your cut-out baby photo: transparency detected (46% of the picture), stored as PNG, background prints at the plain-ball thickness (1.79 mm) and the basketball lines carry on behind her; the Dark option darkens the area around her.

### Version 0.4: soccer, baseball/softball, volleyball, Moon, done (2026-11-18)
Built: soccer ball (32 panels from a true truncated icosahedron; seams plus darker pentagons with a "Pentagon darkness" slider); baseball/softball (the classic seam curve with 108 V-shaped stitches on both sides); classic 18-panel volleyball; Moon from two NASA maps (vendor/moon, about 570 KB, credited in vendor/moon/CREDIT.txt): "Moon only" or "Photo + Moon", crater depth and turn sliders, near side facing front with east to the right as seen from Earth. A Moon-only lamp needs no photo, so the "choose a photo" card is hidden for it. Lines on all shapes use the existing carved / raised / off, width, darkness, fade and turn settings, and stop around text.

Checks passed: 24 automated tests (9 new: soccer pentagons, hexagons and seams; baseball seam on the curve and clear far from it; volleyball sections and strips turned the right way; watertight shells for all three with carved and raised lines; pentagon darkness; Moon map stretching, crater depth and east/west orientation; Moon-only vs Photo + Moon). In the browser: all four shapes selectable and drawn (soccer, baseball and volleyball patterns look right; the Moon shows Copernicus, Mare Imbrium, Mare Crisium and Tycho where they belong); stitches cover both sides of the baseball seam equally; a Moon export completed with no errors.

To check on a print: are baseball stitches crisp at Medium size, and is the Moon's crater depth (40% default) about right?

### Version 0.3: text, done (2026-11-18)
Built: Text tab with several text items (add, copy, hide, remove); carved, bright or raised style; four bundled fonts (Graduate, Montserrat, Pacifico, Playfair Display, all SIL Open Font License, about 80 KB in vendor/fonts); letter height with a small-size warning; bend slider; optional bright outline; click the ball to place, then around / up-down / rotate sliders; basketball lines stop 1.5 mm from text; text included in the Thickness view, export and saved projects.

Checks passed: 15 automated tests (7 new: each style sets the wall correctly, text faces the right way and rotates the right way, lines stop around text only, hidden or empty text does nothing, raised text gives a watertight shell, click placement round-trips). In the browser: all four fonts load, text appears on the lit ball, clicking the ball moves it, and an export with raised text completed at the estimated size (150 mm ball measured 151 mm front to back with the 1 mm raised letters).

To check on a print: are 15 mm varsity letters crisp, and does the bright outline make carved text readable over a dark photo area?

### Test print (milestone 1, done)
Print Medium at Standard detail, opening down, with slicer supports for the curve above the collar. Report back:
1. **Brightness:** are faces clear, too dark, or washed out?
2. **Lines:** too dark, too faint, or right? Is the default angle OK?
3. **Collar fit:** does it seat in your base? Too tight or too loose?
4. **Print quality:** any trouble with supports or the overhang above the collar? Did the slicer handle the file?
5. **Puck light:** its diameter and height (for the base generator).

A photo of the lamp lit on its base helps tune the preview to match reality.
