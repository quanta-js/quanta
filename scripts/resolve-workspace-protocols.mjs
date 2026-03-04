import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const packagesDir = path.join(rootDir, 'packages');

const packages = fs.readdirSync(packagesDir);
const versionMap = {};

// 1. Build a map of package names to their current versions
for (const pkgName of packages) {
    const pkgPath = path.join(packagesDir, pkgName, 'package.json');
    if (fs.existsSync(pkgPath)) {
        const pkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        versionMap[pkgJson.name] = pkgJson.version;
    }
}

console.log('📦 Package version map:', versionMap);

// 2. Resolve workspace:* in all package.json files
for (const pkgName of packages) {
    const pkgPath = path.join(packagesDir, pkgName, 'package.json');
    if (fs.existsSync(pkgPath)) {
        const pkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        let hasChanged = false;

        const dependencyFields = ['dependencies', 'peerDependencies', 'devDependencies'];

        for (const field of dependencyFields) {
            if (pkgJson[field]) {
                for (const [dep, version] of Object.entries(pkgJson[field])) {
                    if (version === 'workspace:*' && versionMap[dep]) {
                        pkgJson[field][dep] = `^${versionMap[dep]}`;
                        hasChanged = true;
                        console.log(`🔗 Resolved ${pkgJson.name} -> ${dep}: workspace:* -> ^${versionMap[dep]}`);
                    }
                }
            }
        }

        if (hasChanged) {
            fs.writeFileSync(pkgPath, JSON.stringify(pkgJson, null, 4) + '\n');
            console.log(`✅ Updated ${pkgJson.name} package.json`);
        }
    }
}

console.log('🚀 Workspace protocol resolution complete.');
