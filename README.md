# Golu Padi (Golu steps) DIY

A foldable, stackable 9-step plywood Golu Padi (each step 6 ft long x 1 ft wide), with an interactive 3D viewer and a cut plan for standard 8 ft x 4 ft boards.

**Open `index.html` in a browser** (needs internet for three.js from a CDN). Three modes:

- **Exploded view**: every piece pulled apart (plates, spacers, feet, hinged links, pivot tabs, back panels, treads).
- **Pack & stack**: animated fold of each 3-wall block on four-bar links, then stacking of treads, panels and blocks.
- **Cut plan**: numbered cut lines for every 8x4 board; click a piece to highlight it in 3D.

## Pictures

Screenshots from the real viewer (6 in riser). Open `index.html` to rotate and play them yourself.

**1. Assembled.** 9 steps, three blocks of three steps, with sample dolls.

![Assembled Golu Padi](images/01-assembled.png)

**2. Exploded.** Every piece pulled apart: plates, spacers, feet, hinged links, pivot tabs, back panels and treads.

![Exploded view](images/02-exploded.png)

**3. Unstack in reverse, stack in this order.** The fold-and-stack mode plays these stages; drag its slider to scrub.

| Stage | Picture |
|---|---|
| Treads off and stacked | ![Treads off](images/03-pack-treads-off.png) |
| Back panels out and laid flat | ![Panels out](images/04-pack-panels-out.png) |
| Hinged links swinging each block's 3 walls together | ![Folding](images/05-pack-folding.png) |
| Blocks folded | ![Folded](images/06-pack-folded.png) |
| Packed: 3 slim blocks, 1 tread stack, 3 flat panels | ![Packed](images/07-packed.png) |

**4. Cut plan.** Numbered saw cuts on each 8x4 board (sheet 1 shown).

![Cut plan](images/08-cut-plan.png)

## Bill of boards

| Riser height | Total 8x4 boards | 19 mm | 12 mm |
|---|---|---|---|
| 6 in | 10 | 3 | 7 |
| 5 in | 9 | 3 | 6 |

69 cut pieces, 1/8 in saw kerf allowed. A plates are 19 mm, B and C plates 12 mm (a deliberate mix to save a board; use 19 mm for tall block C if you want it stiffer).

## Hardware (estimates, verify before buying)

54 dowels 12x28 mm; 24 steel pivot tabs; 24 M8x70 bolts with wing nuts and 48 washers; 18 M8x40 bolts with T-nuts; 18 M6x40 bolts with inserts; about 200 screws; 500 ml wood glue.

## Caveats

- Folding links are 1.75 in wide and may flex; use hardwood or double them.
- The folded stack is rigid only with the bolts and back panel in place.
- Pivots are removable bolts (assumed), on steel tabs outside the plate faces.
- Not yet reviewed in a real browser or built physically. Treat as a design, not a tested product.

## Files

`index.html` page; `golu-model.js` 3D model; `golu-anim.js` explode/fold/pack timeline; `golu-cutui.js` cut-plan UI; `golu-cuts.js` generated cut data; `plan.py` nesting solver (`python3 plan.py` regenerates cuts); `smoke.js` headless collision test (`node smoke.js`).
