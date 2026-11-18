# Lithophane Lamp Creator: Specification
_Interview date: 2026-11-18 · Status: Approved 2026-11-18_

**Build order:** Milestone 1 = basketball + plain sphere with photo, carved/raised lines, opening and collar, lit preview, STL export → test print on the base → Milestone 2 = remaining shapes, multiple photos, AI photo tools, text, base generator, phone polish.

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
13. **Markings per design**: each marking set (lines, panels, laces, seams) can be **carved in** (thicker plastic, glows dark, smooth outside), **raised** (sticks out from the surface), or **off**. Line width and darkness are adjustable.
14. **Size presets** plus a custom size field. The football scales with the preset:

    | Preset | Ball diameter | Football (length × width) |
    |---|---|---|
    | Small | 100 mm | 160 × 100 mm |
    | **Medium (default)** | 150 mm | 240 × 150 mm |
    | Large | 200 mm | 280 × 175 mm |

    The custom size and last-used preset are remembered.
14a. **Printer bed check**: a setting holds your bed size (default 256 × 256 × 256 mm). The app warns if a part won't fit. If a part only fits placed diagonally (the Large football does), it says "rotate 45° in your slicer".

**Text**

15. **Add text** (name, number, date): type it, pick from a few bundled fonts, set size, and place it on the ball. Carved in (glows dark) or raised. Several text items per ball.

**Mounting and base**

16. **Bottom opening + collar** on every shape, sized to fit the base. The opening diameter, collar height and fit clearance are adjustable.
17. **Base generator**: exports a separate printable base STL. Three light types, default **round LED puck**:
    - Round LED puck: enter the puck's diameter and height
    - LED strip / ring: enter its size; the base gets a channel and cable exit
    - E12 / E26 bulb socket: enter the socket size; a taller base with a cord exit
    All bases include a cable or switch notch and a seat that matches the ball's collar.
    - **Light riser** (optional): a post that lifts the light up toward the middle of the ball so a big ball lights evenly instead of bright at the bottom and dim at the top. It's on by default for Large and must pass through the 50 mm opening.

**Preview and export**

18. **3D preview** (rotate and zoom) with a toggle between **simulated backlit glow** (roughly how it looks on the base) and **plain grey model** (for checking shape and markings).
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
- **Printing assumption:** one piece printed opening-down. The steep curve just above the opening needs slicer supports, so the app doesn't add any.
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
| Text | In version 1 | You |
| Football mounting | Lying on its side | You |
| Overhang | Slicer supports; one-piece shell | You |
| Base | App generates a base; puck (default), LED ring/strip, bulb socket | You |
| Saving | Browser auto-save + project files | You |
| Shapes | Basketball, soccer, football, baseball, volleyball, plain sphere, Moon | You |
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
| Relief side | Photo relief on the inside, smooth outside | Assumed (Claude's default) |
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
- **File sizes:** measured (see feature 20). Still to confirm: does your slicer handle the Standard file comfortably? (You, at test print)

## How we'll know it works
1. Load one of your real photos, choose basketball, and get a print-ready STL in under 5 minutes with only light slider tweaking.
2. The exported STL opens in your slicer with no repair warnings, and the ball and base fit together on the first print.
3. Lit on the base, the face in the photo is clear and not too dark, and the basketball lines show as dark lines over the photo.
4. Save a project, close the browser, reopen it, and continue exactly where you left off. Send the project file to your friend and it opens the same for them.
5. The Moon in moon-only mode shows recognisable maria and craters when lit.
6. On a phone, you can load a photo, adjust it, preview, and export at Standard.

## Build progress

### Milestone 1: done (2026-11-18, git commit 278a773)
Built and tested: photo loading with automatic adjustments and tone sliders; photo placement and window settings; basketball and plain sphere; carved, raised or no lines; Small/Medium/Large sizes; opening and collar; Lit and Plain preview; STL export with detail choice, bed-fit check and plastic estimate; browser auto-save and project files; desktop and phone layouts.

Checks passed: 8 automated geometry tests; exported STLs re-read from raw coordinates came back closed with no bad triangles; export, reload/restore, project save/open and phone layout tested in the browser.

Not built yet (milestone 2): multiple photos placed freely; soccer ball, football, baseball, volleyball, Moon; background removal and face brightening; text; base generator and light riser.

### Test print (next step)
Print Medium at Standard detail, opening down, with slicer supports for the curve above the collar. Report back:
1. **Brightness:** are faces clear, too dark, or washed out?
2. **Lines:** too dark, too faint, or right? Is the default angle OK?
3. **Collar fit:** does it seat in your base? Too tight or too loose?
4. **Print quality:** any trouble with supports or the overhang above the collar? Did the slicer handle the file?
5. **Puck light:** its diameter and height (for the base generator).

A photo of the lamp lit on its base helps tune the preview to match reality.
