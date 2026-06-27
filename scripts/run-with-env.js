#!/usr/bin/env node

const { spawn } = require('child_process');
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
  console.warn('[run-with-env] No root .env file found, continuing with existing process.env');
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: run-with-env.js exec <command> [args...]');
  process.exit(1);
}

if (args[0] !== 'exec') {
  console.error('Expected first argument to be exec');
  process.exit(1);
}

const cmd = args[1];
const cmdArgs = args.slice(2);

const child = spawn(cmd, cmdArgs, {
  stdio: 'inherit',
  env: process.env,
  shell: false,
});

child.on('exit', (code) => {
  process.exit(code);
});
