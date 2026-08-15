import { config } from 'dotenv';
import { resolve } from 'node:path';

// Support both `pnpm dev:api` from the workspace root and direct execution from services/api.
config({ path: [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')] });
