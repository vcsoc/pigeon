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
      ['@napi-rs/canvas-darwin-arm64', 'node_modules/pdfjs-dist/node_modules/@napi-rs/canvas-darwin-arm64'],
      ['@napi-rs/canvas-darwin-x64', 'node_modules/pdfjs-dist/node_modules/@napi-rs/canvas-darwin-x64']
    ];
    for (const [name, packagePath] of packages) await installPackage(name, lockedVersion(packagePath), path.join(root, packagePath), temporaryDirectory);
    await prepareFfmpeg(temporaryDirectory);
    console.log('Prepared universal macOS native dependencies for arm64 and x86_64');
  } finally {
    await fsp.rm(temporaryDirectory, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
