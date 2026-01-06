#!/usr/bin/env node

/**
 * Check Setup Script
 * Verifies that all dependencies and configurations are in place
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const checks = [];
let hasErrors = false;

function check(name, condition, errorMsg) {
    if (condition) {
        checks.push({ name, status: '✓', message: 'OK' });
    } else {
        checks.push({ name, status: '✗', message: errorMsg });
        hasErrors = true;
    }
}

function fileExists(filePath) {
    return fs.existsSync(path.join(process.cwd(), filePath));
}

function dirExists(dirPath) {
    const fullPath = path.join(process.cwd(), dirPath);
    return fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory();
}

function commandExists(cmd) {
    try {
        execSync(`which ${cmd}`, { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

console.log('\n🔍 Checking EAON setup...\n');

// Check Node.js version
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
check('Node.js version', majorVersion >= 18, `Node.js 18+ required, found ${nodeVersion}`);

// Check npm
check('npm installed', commandExists('npm'), 'npm not found in PATH');

// Check Docker
check('Docker installed', commandExists('docker'), 'Docker not found in PATH');

// Check project structure
check('contracts/ directory', dirExists('contracts'), 'contracts/ directory missing');
check('oracle-nodes/ directory', dirExists('oracle-nodes'), 'oracle-nodes/ directory missing');
check('mock-hems/ directory', dirExists('mock-hems'), 'mock-hems/ directory missing');
check('test/ directory', dirExists('test'), 'test/ directory missing');
check('scripts/ directory', dirExists('scripts'), 'scripts/ directory missing');

// Check configuration files
check('package.json', fileExists('package.json'), 'package.json missing');
check('hardhat.config.js', fileExists('hardhat.config.js'), 'hardhat.config.js missing');

// Check environment
check('.env file', fileExists('.env'), '.env file missing (copy from env.example)');

// Check node_modules
check('Dependencies installed', dirExists('node_modules'), 'Run npm install');

// Print results
console.log('Setup Check Results:');
console.log('─'.repeat(50));
checks.forEach(c => {
    console.log(`${c.status} ${c.name}: ${c.message}`);
});
console.log('─'.repeat(50));

if (hasErrors) {
    console.log('\n❌ Some checks failed. Please fix the issues above.\n');
    process.exit(1);
} else {
    console.log('\n✅ All checks passed! Ready to develop.\n');
    process.exit(0);
}


