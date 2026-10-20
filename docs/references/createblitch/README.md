# CreateBlitch public feature survey

Source: https://createblitch.com/app, inspected 2026-10-19.
`ui-survey.json` contains factual product names and DOM control options/defaults.
Some inactive controls have blank defaults; those are not authoritative dimensions.

95 presets map to 23 families. Shared features include six text lines with fonts,
weight/slant/case/curves and independent placement, multiple artwork slots, plate
shapes, border/middle layers, holes/tabs/stands/backing, two-sided designs, local
storage/settings, undo/redo, image preprocessing, printer profiles and hole-fit
calibration, shrink compensation, STL and multi-material 3MF, CSV/order batches,
colour consolidation and multi-plate export.

Reference billing and account services are external. Geometry is independently
implemented using the app's existing open source dependencies. Original provider
artwork, source code and commercial service access are not redistributed.

Implementation and verification status is tracked in the Product Studio README
and focused tests; catalog presence alone does not establish feature parity.
