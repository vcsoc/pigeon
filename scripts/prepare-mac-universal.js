'use strict';

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pipeline } = require('node:stream/promises');
const { createGunzip } = require('node:zlib');

const root = path.join(__dirname, '..');
const packageLock = require(path.join(root, 'package-lock.json'));

function lockedVersion(packagePath) {
  const version = packageLock.packages[packagePath]?.version;
  if (!version) throw new Error(`Missing locked package: ${packagePath}`);
  return version;
}

async function installPackage(name, version, destination, temporaryDirectory) {
  const packageJson = path.join(destination, 'package.json');
  if (fs.existsSync(packageJson) && require(packageJson).version === version) return;
  await fsp.rm(destination, { recursive: true, force: true });
  await fsp.mkdir(destination, { recursive: true });
  const output = execFileSync('npm', ['pack', '--silent', '--pack-destination', temporaryDirectory, `${name}@${version}`], { cwd: root, encoding: 'utf8' }).trim().split(/\r?\n/).at(-1);
  execFileSync('tar', ['-xzf', path.join(temporaryDirectory, output), '--strip-components=1', '-C', destination]);
}

async function download(url, destination) {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok || !response.body) throw new Error(`Download failed (${response.status}): ${url}`);
  await pipeline(response.body, createGunzip(), fs.createWriteStream(destination));
  await fsp.chmod(destination, 0o755);
}

function findMachOBinary(packagePath, pattern) {
  const directory = path.join(root, packagePath);
  const matches = fs.readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && pattern.test(entry.name))
    .map((entry) => path.join(entry.parentPath || entry.path, entry.name));
  if (matches.length !== 1) throw new Error(`Expected one native binary in ${packagePath}, found ${matches.length}`);
  return matches[0];
}

async function universalizePair(arm64Path, x64Path, temporaryDirectory) {
  const output = path.join(temporaryDirectory, `universal-${path.basename(arm64Path)}`);
  execFileSync('lipo', ['-create', arm64Path, x64Path, '-output', output]);
  const architectures = execFileSync('lipo', ['-archs', output], { encoding: 'utf8' }).trim().split(/\s+/).sort();
  if (architectures.join(' ') !== 'arm64 x86_64') throw new Error(`Unexpected native dependency architectures: ${architectures.join(', ')}`);
  await Promise.all([fsp.copyFile(output, arm64Path), fsp.copyFile(output, x64Path)]);
  await Promise.all([fsp.chmod(arm64Path, 0o755), fsp.chmod(x64Path, 0o755)]);
}

async function prepareNativeLibraries(temporaryDirectory) {
  const pairs = [
    [
      findMachOBinary('node_modules/@img/sharp-darwin-arm64', /^sharp-darwin-arm64-.*\.node$/),
      findMachOBinary('node_modules/@img/sharp-darwin-x64', /^sharp-darwin-x64-.*\.node$/)
    ],
    [
      findMachOBinary('node_modules/@img/sharp-libvips-darwin-arm64', /^libvips-cpp.*\.dylib$/),
      findMachOBinary('node_modules/@img/sharp-libvips-darwin-x64', /^libvips-cpp.*\.dylib$/)
    ],
    [
      findMachOBinary('node_modules/@napi-rs/canvas-darwin-arm64', /^skia\.darwin-arm64\.node$/),
      findMachOBinary('node_modules/@napi-rs/canvas-darwin-x64', /^skia\.darwin-x64\.node$/)
    ]
  ];
  for (const [arm64Path, x64Path] of pairs) await universalizePair(arm64Path, x64Path, temporaryDirectory);
}

async function prepareFfmpeg(temporaryDirectory) {
  const ffmpegPackage = require(path.join(root, 'node_modules', 'ffmpeg-static', 'package.json'));
  const release = ffmpegPackage['ffmpeg-static']['binary-release-tag'];
  const baseUrl = `https://github.com/eugeneware/ffmpeg-static/releases/download/${release}`;
  const x64 = path.join(temporaryDirectory, 'ffmpeg-x64');
  const arm64 = path.join(temporaryDirectory, 'ffmpeg-arm64');
  await Promise.all([
    download(`${baseUrl}/ffmpeg-darwin-x64.gz`, x64),
    download(`${baseUrl}/ffmpeg-darwin-arm64.gz`, arm64)
  ]);
  const target = path.join(root, 'node_modules', 'ffmpeg-static', 'ffmpeg');
  execFileSync('lipo', ['-create', x64, arm64, '-output', target]);
  await fsp.chmod(target, 0o755);
  const architectures = execFileSync('lipo', ['-archs', target], { encoding: 'utf8' }).trim().split(/\s+/).sort();
  if (architectures.join(' ') !== 'arm64 x86_64') throw new Error(`Unexpected ffmpeg architectures: ${architectures.join(', ')}`);
}

async function main() {
  if (process.platform !== 'darwin') throw new Error('Universal macOS preparation must run on macOS');
  const temporaryDirectory = await fsp.mkdtemp(path.join(os.tmpdir(), 'pigeon-mac-universal-'));
  try {
    const packages = [
      ['@img/sharp-darwin-arm64', 'node_modules/@img/sharp-darwin-arm64'],
      ['@img/sharp-darwin-x64', 'node_modules/@img/sharp-darwin-x64'],
      ['@img/sharp-libvips-darwin-arm64', 'node_modules/@img/sharp-libvips-darwin-arm64'],
      ['@img/sharp-libvips-darwin-x64', 'node_modules/@img/sharp-libvips-darwin-x64'],
      ['@napi-rs/canvas-darwin-arm64', 'node_modules/@napi-rs/canvas-darwin-arm64'],
      ['@napi-rs/canvas-darwin-x64', 'node_modules/@napi-rs/canvas-darwin-x64']
    ];
    for (const [name, packagePath] of packages) await installPackage(name, lockedVersion(packagePath), path.join(root, packagePath), temporaryDirectory);
    await prepareNativeLibraries(temporaryDirectory);
    await prepareFfmpeg(temporaryDirectory);
    console.log('Prepared fully universal macOS native dependencies for arm64 and x86_64');
  } finally {
    await fsp.rm(temporaryDirectory, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
