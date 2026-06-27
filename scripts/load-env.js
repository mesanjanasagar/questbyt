const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const rootDir = path.resolve(__dirname, '..');
const envLocalPath = path.join(rootDir, '.env.local');
const envPath = path.join(rootDir, '.env');
const loadPath = fs.existsSync(envLocalPath) ? envLocalPath : envPath;

if (loadPath && fs.existsSync(loadPath)) {
  dotenv.config({ path: loadPath });
} else {
  console.warn('[load-env] No root .env file found, continuing with process.env only');
}
