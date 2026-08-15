# Hardware

Hardware values live in `packages/types/src/index.ts` and the Supabase `hardware` table. The built-in E27 and Bambu LED Kit 001 entries are adapter envelopes, not a claim that every hardware revision is identical. Verify the exact purchased socket/kit before manufacturing and update the configuration record with its reference and verification date.

The shared Core uses a bayonet connector with configurable diameter, clearance, lock angle and height. Hardware adapters add compatibility without changing the core engine API.
