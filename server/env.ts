// ==============================================================================
// ENVIRONMENT INITIALIZATION MODULE (Load Before Any DB or App Modules)
// ==============================================================================

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// 1. Load primary .env file from root
dotenv.config();

// 2. Load secondary .env.local if present
const localEnvPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(localEnvPath)) {
  dotenv.config({ path: localEnvPath, override: true });
}

// 3. Ensure any Google AI Studio container settings are loaded
if (fs.existsSync('/app/.dev.env.json')) {
  try {
    const devEnv = JSON.parse(fs.readFileSync('/app/.dev.env.json', 'utf8'));
    for (const [key, value] of Object.entries(devEnv)) {
      if (!process.env[key] && typeof value === 'string') {
        process.env[key] = value;
      }
    }
  } catch (e) {
    // Ignore JSON parse errors in container env
  }
}

export function getDatabaseEnv() {
  return {
    isProduction: process.env.NODE_ENV === 'production',
    host: (process.env.DB_HOST || '').trim(),
    port: parseInt(process.env.DB_PORT || '3306', 10),
    database: (process.env.DB_NAME || '').trim(),
    user: (process.env.DB_USER || '').trim(),
    password: process.env.DB_PASSWORD || ''
  };
}
