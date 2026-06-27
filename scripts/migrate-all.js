#!/usr/bin/env node

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const rootDir = path.resolve(__dirname, '..');
const envLocalPath = path.join(rootDir, '.env.local');
const envPath = path.join(rootDir, '.env');
const loadPath = fs.existsSync(envLocalPath) ? envLocalPath : envPath;

if (loadPath && fs.existsSync(loadPath)) {
  dotenv.config({ path: loadPath });
  console.info(`[migrate-all] Loaded environment from ${loadPath}`);
} else {
  console.warn('[migrate-all] No root .env file found, continuing with existing process.env');
}

const servicesDir = path.join(rootDir, 'services');
const serviceNames = fs.readdirSync(servicesDir).filter((name) => {
  const pkgPath = path.join(servicesDir, name, 'package.json');
  return fs.existsSync(pkgPath);
});

const migrationServices = serviceNames.filter((name) => {
  const pkgPath = path.join(servicesDir, name, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  return pkg.scripts && pkg.scripts['db:migrate'];
});

if (migrationServices.length === 0) {
  console.error('[migrate-all] No services with db:migrate scripts found');
  process.exit(1);
}

for (const serviceName of migrationServices) {
  const serviceDir = path.join(servicesDir, serviceName);
  console.info(`[migrate-all] Running db:migrate for ${serviceName}`);

  const result = spawnSync('pnpm', ['run', 'db:migrate'], {
    cwd: serviceDir,
    stdio: 'inherit',
    env: process.env,
    shell: false,
  });

  if (result.error) {
    console.error(`[migrate-all] Failed to start migration for ${serviceName}:`, result.error);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`[migrate-all] Migration failed for ${serviceName} with exit code ${result.status}`);
    process.exit(result.status || 1);
  }
}

console.info('[migrate-all] All migrations completed successfully');
