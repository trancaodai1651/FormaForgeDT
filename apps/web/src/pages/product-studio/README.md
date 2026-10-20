# Product Studio

Public, local-first bilingual product generator workspace at `/product-studio`.
Reference inventory: `docs/references/createblitch/ui-survey.json`, observed through
the public UI on 2026-10-19: 95 presets, 23 generator families.

The implementation belongs in this page boundary. Reuse FormaForge's Manifold,
image preprocessing, font assets, preview and printable export infrastructure.
Do not embed the reference app, copy its application code or require its account.
The survey records factual control names/options, not original artwork or source.

Completion gates: inventory coverage, working EN/VI controls, geometry for each
family, closed preview/export meshes, real holes/joints, readable QR round trips,
calibration scaling, batch quantity/colour/packing manifests, backup round trips,
and browser checks on phone/tablet/desktop. Build success alone is insufficient.

Service boundary: subscriptions, commercial licences, account/billing operations
and support at createblitch.com belong to that provider. No interaction with its
paid export gate or account system is used to produce local FormaForge models.

## Implemented workspace

The public toolbox and desktop include this route. Controls, errors, modal actions,
catalog names and mobile navigation support English and Vietnamese. The workspace
uses the existing FormaForge navy/red theme, light/dark/auto modes, a scrolling
inspector on desktop/tablet and separate model/edit panes on phones.

| Area | Native implementation |
| --- | --- |
| Text, tags, signs, toppers, medals, shoe charms | Six independently styled/positioned lines, font library/uploads, real Lato weight/italic files, curves, silhouette offsets/counters, 20 outline shapes, star/flute/gear parameters, smooth/chamfered edges, middle/border layers, keyrings/angled tabs/slots, stands, magnet/pin/NFC pockets, reverse text/artwork, domes and laurel/ring/recess/ball decorations. |
| Artwork and model surfaces | Six SVG/raster slots, original vector starter graphics, touch crop/resize, numeric crops, circular/elliptical/rounded crops, rotate/flip, brightness/contrast/saturation/threshold, colour reduction, speck removal, smoothing, per-component colours/heights/visibility, SVG downloads, repeat processing from embedded original, STL/3MF import and upper-surface projection with click placement and model rotation. |
| QR and scan boards | Six payload formats, image/camera input, EMV merchant fields when encoded, SVG preview/download, four-module quiet zones, module/fixed sizing, ECC, centred artwork logo, per-code XY/caption/colours, 1–12 codes, automatic layouts, front/back/both faces and NFC pockets. Plate fitting preserves the complete QR tile on curved outlines. |
| Frames | Photo openings, overlap and thickness, friction/snap/magnet backs, separate glue/magnet face border, wall mounting, easel, clipped or backed decorative artwork. Magnet diameter/depth are preserved by enlarging the rim and panels as needed. |
| Beads | Character beads, artwork charms, pen/straw toppers, nine cord/pen size presets, auto/fixed/explicit sizing, round/hex bores through X/Y/Z, blind topper bores, clearance, grip ribs, name/artwork combinations and optional border. |
| Cutters and stencils | Letter sets and artwork/text cutters, grip rims, imprint bridges, pusher and holding tray, stencil counter bridges with direction/count/angle, small-counter cleanup and optional flat grip handle. |
| Rollers | Pin, sleeve, brayer and flat mat; procedural pattern library, repeated/wrapped text/artwork, mirrored/staggered/scattered arrangements, panels, relief/engraving with rounded/bevelled edges, screw/push/spinning handles, real axle/fork bores and dough guide rings. |
| Trays, baskets and boxes | Single/row/ring/flower compartments, custom grid/halves/cross/spoke dividers, repeated floor artwork, rounded/chamfered rims, stacking recesses; variable basket profiles, stakes/weavers, diagonal lattices, solid/open/woven floors and independent band/weave colours; sliding lid rails, catch clearance pocket, grip/ring pull, decorative lids and compartments. |
| Stamps and clickers | Stamp text presets, mirrored relief, solid/threaded backs, M8/M10/M12/M16 matching threads and separate handle/fit variants; MX assets shared with Clicker Lab, 1–12 caps/mounts, manual switch centres with overlap validation, shape/name/art caps, dome/cone, independent holder/cap/legend colours, bar/linked/staggered holders, header/footer pieces and keyring. |
| Braille | English uncontracted letters/numbers/basic punctuation, tactile dot dimensions and separate printed lines. Unsupported characters are reported explicitly. Vietnamese UI does not imply a Vietnamese Braille transcription engine. |
| Files and production | Undo/redo/reset, IndexedDB autosave/copies/archive/restore, complete JSON with original assets/font licences, JSON settings preserving text/artwork, reopening embedded Product Studio projects from 3MF; printer CRUD/archive, bed/nozzle/layer/shrink/clearance and printable calibration bar/pin; closed union STL, independent material 3MF, per-part STL ZIP. |
| Orders | Quoted/multiline CSV/TSV, explicit header detection, column mapping, per-row preview/images, inheritance, quantities, colour consolidation, multiple plates, STL/3MF/both ZIP output, original orders/settings and order/copy manifest. Cancellation stops downloads. |

Product presets use independently implemented procedural geometry and starter
artwork. They are not copies of the provider's proprietary illustration library.
The factual control survey supports feature comparison; it does not establish
identical meshes, commercial services or every possible parameter combination.

## Verification

See [the verification record](../../../../../docs/references/createblitch/VERIFICATION.md).
The geometry suite covers all 95 defaults, advanced variants, positive closed
meshes, ground plane, QR masks, real magnet dimensions, threaded clearances,
calibration backups, twelve MX caps, CSV mapping, backups and packed exports.
Camera hardware capture and physical print fit still depend on the user's devices;
use the calibration print before producing fitted hardware in quantity.
