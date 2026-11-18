# Lithophane Lamp Creator: Specification
_Interview date: 2026-11-18 · Status: Approved 2026-11-18 · Cube shape (feature 12a) added and approved 2026-11-18_

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
| 0.9 | AI photo tools (background, face brightening) |
| 1.0 | Phone and tablet polish, final check against this spec |

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
   - Background removal or dimming (an in-browser AI model separates the subject; the background can be faded, darkened or blurred)
   - Face brightening (an in-browser face detector lifts shadows on faces)
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
21. **Exported shells are watertight** (no holes or flipped faces), so slicers accept them without repair.

**Saving**

22. **Auto-save in the browser**: the current project is restored if the page is closed or refreshed.
23. **Save / Open project file**: downloads one file holding the photo and all settings. It can be reopened later or sent to your friend.

**Devices**

24. **Desktop, tablet and phone layouts.** On phones, choosing Fine export shows a warning that it may fail and suggests Standard, but still allows it.

### Later (not in version 1)
- Splitting the shell into two halves for support-free printing
- Customer-facing features on the hosted site (ads placement, help pages, sample gallery)
- 3MF export (smaller files than STL)
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
- **Bundled assets:** NASA moon height and color maps (public domain, downsized), AI models for background and face detection, open-license fonts. All are included with the app so it works offline.

## Rules and edge cases
- **Light vs. thickness:** brighter photo pixels = thinner plastic (min thickness); darker = thicker (max thickness). Defaults are 0.8 mm min, 3.0 mm max *(assumed)*.
- **Photo relief is on the inside** of the shell, so the outside stays smooth like a real ball. Only "raised" markings and text stick out *(assumed)*.
- **Carved markings and text** use max thickness (or a set darkness) so they show dark when lit, layered over the photo.
- **Opening and collar** are kept clear of photo relief and markings so the ball seats cleanly.
- **Cube printing:** one piece printed upside down (top face on the bed), no supports. Thicknesses on the top face are built from flat layers, so very fine shading there is limited by layer height.
- **Cube even glow:** thinning for distance from the light never goes below the minimum thickness, so it can only brighten dim areas up to the brightest setting; with strength at 0 the cube is shaded by the photos alone.
- **Printing assumption:** one piece printed opening-down. The steep curve just above the opening needs slicer supports, so the app doesn't add any.
- **SVG files** have no fixed pixel size, so they are always drawn at full working resolution (2400 px on the long side), whatever size the file lists. *(0.2)*
- **Very large or tiny photos:** large photos are scaled down to what the chosen detail level can use. Tiny photos show a "low resolution, may look blurry" warning.
- **AI features failing** (older browser, model won't load): the photo still works without them and a banner says which feature is unavailable.
- **Export too big for the device:** warn before starting. If the browser runs out of memory, show a clear message suggesting a lower detail level, not a silent crash.

## Screens and look
- **One main workspace:** 3D preview in the centre; controls in panels for Photo / Shape / Markings / Text / Base / Export. On phones the panels become tabs or a bottom sheet under the preview.
- **Dark showroom style:** dark background like your product photo so the glowing preview stands out, with warm amber accents.
- **Photo panel** shows the adjusted photo as a grey map (what becomes thickness) with a before/after toggle.

## Environment and deployment
- **Now:** runs locally on your Windows PC in Chrome. A `start.bat` launches a tiny local web server (Node is already installed) and opens the browser, because the AI models need to be served that way rather than opened as a plain file. It works with no internet.
- **Your friend (before hosting):** gets the folder and runs the same `start.bat` (needs Node installed), or waits for the hosted version.
- **Later:** the same files go on a free static host (GitHub Pages, Netlify or Cloudflare Pages). No server code, $0 hosting.
- **Technology:** a plain HTML/JavaScript web app; Three.js for 3D (bundled locally); MediaPipe-style in-browser models for background and face detection (bundled locally).

## Decisions
| Topic | Decision | Decided by |
|---|---|---|
| Users | You + one offsite friend; public free site later | You |
| Where it runs | Locally now, free static hosting later | You |
| Processing | Everything in the browser, photos never uploaded | Assumed (Claude's default) |
| Photo coverage | Adjustable from front window to full wrap | You |
| Markings | Carved, raised or off, per design | You |
| Auto-adjust | Levels/contrast, sharpen, background, face brightening | You |
| Preview | Toggle lit glow / plain grey | You |
| Export detail | Draft / Standard / Fine chosen at export | You |
| Text | In version 1 (0.3) | You |
| Text styles | Carved (dark), bright (thinner) or raised, per text item | You |
| Text placing | Click the ball, then fine-tune with sliders | You |
| Text fonts | Varsity block, bold sans, script, serif | You |
| Text readability | Optional bright outline around letters, off by default | You |
| Text arc | Bend slider, straight by default | You |
| Lines under text | Lines stop around text with a small gap | You |
| Text size default | Letters 15 mm tall; app warns below 6 mm (script below 10 mm) since thin strokes may not print | Assumed (Claude's default) |
| Football mounting | Lying on its side | You |
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
| Overlapping photos | The photo on top wins, with its soft edge blending into the one below | Assumed (Claude's default) |
| Settings per photo | Each photo has its own tone adjustments, size, position and window shape | Assumed (Claude's default) |
| Devices | Desktop, tablet and phone | You |
| Phone exports | Warn about Fine, but allow | You |
| Look | Dark showroom style, amber accents | You |
| Priority | Print quality first | You |
| Sizes | Small / Medium / Large presets (100 / 150 / 200 mm balls), Medium default, plus custom | You |
| Printer bed | 256 × 256 × 256 mm, with a fit warning | You |
| Large football | 280 × 175 mm, printed diagonally on the bed | Assumed (Claude's default) |
| Light riser | Optional in the base, on by default for Large | Assumed (Claude's default) |
| Print time | Not a concern; quality over speed | You |
| Opening / collar | 50 mm opening, 5 mm collar | You |
| Printing | White PLA, 0.4 mm nozzle, opening-down | Assumed (you accepted defaults) |
| Thickness | 0.8 mm min, 3.0 mm max | Assumed (you accepted defaults) |
| Relief side | Photo relief always on the inside, smooth outside. An "outside" option was tried in 0.2.0 and removed in 0.2.1: it has no good use for these lamps | You (2026-11-18) |
| Collar wall | 2 mm (opening 50 mm inside, 54 mm outside) | Assumed (Claude's default) |
| Plain band above collar | First 4 mm of the ball above the collar kept plain (no photo or lines), blending in over 6 mm | Assumed (Claude's default) |
| Carved line darkness | Lines go up to 0.4 mm past the thickest setting so they show over dark photo areas | Assumed (Claude's default) |
| Basketball line angle | Default turn: spin 60°, tilt 20°; adjustable | Assumed (Claude's guess, check on print) |
| Line width | Automatic = 2% of ball size (3 mm on Medium) | Assumed (Claude's default) |
| Detail presets | Draft 0.5 / Standard 0.3 / Fine 0.2 mm for all sizes | Assumed (Claude's default) |
| Local address | http://localhost:5178 via start.bat | Assumed (Claude's default) |
| Local launcher | `start.bat` + tiny local server | Assumed (Claude's default) |

## Open questions
- **Multiple photos:** is there a maximum you'd use (2? 5? 10?), and should photos be able to blend into each other where they overlap, or always have the top one win? (You, before milestone 2)
- **Your current process and tools:** not yet described. Knowing which software and settings give you good prints today would help tune the defaults. (You)
- **Your puck light:** its diameter and height, so the default base fits it. (You, ideally with calipers)
- **Football shape:** a real football is more pointed than a perfect oval. Version 1 has a "tip sharpness" slider; confirm it matches your footballs. (You, after first test print)
- **Cube underside:** the angled underside hangs a little below the walls. Check on the first cube print that it looks right sitting on your base, or whether the walls should reach further down. (You, at the cube test print)
- **Even glow for balls too?** The same distance correction could help Large balls. Decide after seeing it on the cube. (You, after 0.7)
- **File sizes:** measured (see feature 20). Still to confirm: does your slicer handle the Standard file comfortably? (You, at test print)

## How we'll know it works
1. Load one of your real photos, choose basketball, and get a print-ready STL in under 5 minutes with only light slider tweaking.
2. The exported STL opens in your slicer with no repair warnings, and the ball and base fit together on the first print.
3. Lit on the base, the face in the photo is clear and not too dark, and the basketball lines show as dark lines over the photo.
4. Save a project, close the browser, reopen it, and continue exactly where you left off. Send the project file to your friend and it opens the same for them.
5. The Moon in moon-only mode shows recognisable maria and craters when lit.
6. On a phone, you can load a photo, adjust it, preview, and export at Standard.
7. A Medium cube with five different photos exports in one STL, prints upside down with no supports, sits on your current base, and glows evenly from bottom to top.

## Build progress

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
