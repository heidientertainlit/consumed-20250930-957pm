---
name: Tribe fit calibration
description: How strict Tribe evidence scores should translate into user-facing recommendation percentages.
---

Tribe scoring should remain strict when deciding whether a user has enough breadth and signal coverage to qualify for a recommendation. Once a Tribe clears that gate, calibrate its displayed fit into the 70–100% range while preserving ordering and underlying evidence.

**Why:** Users interpret a suggested community below 70% as a weak or irrelevant recommendation, even when the raw score is low only because it measures coverage across every defining signal.

**How to apply:** Keep the evidence threshold and ranking based on the strict base score. Apply the calibrated range only after qualification; do not manufacture recommendations from sparse, single-dimension overlap.