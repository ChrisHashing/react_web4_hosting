#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

const projectName = process.argv[2];

if (!projectName) {
  console.error('Please specify the project name');
  process.exit(1);
}

console.log(`Creating a new React Web4 app: ${projectName}`);

// Create React App
execSync(`npx create-react-app ${projectName}`, { stdio: 'inherit' });

execSync(`cd ${projectName} && npx hardhat init`, { stdio: 'inherit' });

// Copy template files
const templateDir = path.join(__dirname, '..', 'templates');
const projectDir = path.join(process.cwd(), projectName);

// Copy all files from templates to project directory
fs.copySync(templateDir, projectDir);

// Create .env file
fs.copySync(path.join(templateDir, '.env.template'), path.join(projectDir, '.env'));

// Modify package.json
const packageJsonPath = path.join(projectDir, 'package.json');
const packageJson = require(packageJsonPath);
const templatePackageJson = require(path.join(templateDir, 'package.json'));

// Merge dependencies
packageJson.dependencies = {
  ...packageJson.dependencies,
  ...templatePackageJson.dependencies
};

// Merge scripts
packageJson.scripts = {
  ...packageJson.scripts,
  ...templatePackageJson.scripts
};

fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

console.log('React Web4 app created successfully!');
console.log('To get started:');
console.log(`  1. cd ${projectName}`);
console.log('  2. Fill in the values in the .env file');
console.log('  3. npm install');
console.log('  4. npm start');
console.log('');
console.log('To deploy your app:');
console.log('  npm run deploy');