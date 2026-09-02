const path = require('node:path');

const RAW_IMAGE_EXTENSIONS = Object.freeze(['.3fr','.ari','.arw','.bay','.cap','.cr2','.cr3','.crw','.dcr','.dcs','.dng','.drf','.eip','.erf','.fff','.gpr','.iiq','.k25','.kdc','.mdc','.mef','.mos','.mrw','.nef','.nrw','.orf','.pef','.ptx','.pxn','.raf','.raw','.rw2','.rwl','.rwz','.sr2','.srf','.srw','.x3f']);
const RAW_IMAGE_EXTENSION_SET = new Set(RAW_IMAGE_EXTENSIONS);
const HEIC_IMAGE_EXTENSIONS = Object.freeze(['.heic','.heif']);
const HEIC_IMAGE_EXTENSION_SET = new Set(HEIC_IMAGE_EXTENSIONS);
const FILE_TYPE_GROUPS = Object.freeze({
  images: Object.freeze(['.jpg','.jpeg','.png','.pnj','.webp','.gif','.bmp','.ico','.avif','.heic','.heif','.tif','.tiff','.svg','.psd',...RAW_IMAGE_EXTENSIONS]),
  videos: Object.freeze(['.mp4','.mov','.m4v','.webm','.avi','.mkv','.ogv','.mpg','.mpeg','.m2v','.mts','.m2ts','.3gp','.3g2','.wmv','.flv']),
  audio: Object.freeze(['.mp3','.wav','.m4a','.aac','.flac','.ogg','.oga','.opus','.aif','.aiff','.wma']),
  documents: Object.freeze(['.pdf','.txt','.rtf','.md','.markdown','.doc','.docx','.odt','.pages','.epub','.html','.htm','.json','.jsonc','.yaml','.yml']),
  presentations: Object.freeze(['.ppt','.pptx','.odp','.key','.keynote']),
  spreadsheets: Object.freeze(['.xls','.xlsx','.ods','.numbers','.csv','.tsv']),
  design: Object.freeze(['.af','.afdesign','.afphoto','.pspimage','.ai','.sketch','.free','.fig','.eps','.snagx','.xd','.indd','.idml','.lrcat','.lrcat-data','.lrprev','.lrtemplate']),
  fonts: Object.freeze(['.ttf','.otf','.woff','.woff2']),
  models: Object.freeze(['.obj','.fbx','.stl','.gltf','.glb','.dae','.3ds','.blend'])
});

const DEFAULT_INDEX_CATEGORIES = Object.freeze(Object.keys(FILE_TYPE_GROUPS));
const extensionSet = (categories) => new Set(categories.flatMap((category) => FILE_TYPE_GROUPS[category] || []));
const IMAGE_EXTENSIONS = extensionSet(['images']);
const VIDEO_EXTENSIONS = extensionSet(['videos']);
const AUDIO_EXTENSIONS = extensionSet(['audio']);
const FONT_EXTENSIONS = extensionSet(['fonts']);
const DOCUMENT_EXTENSIONS = extensionSet(['documents','presentations','spreadsheets','design','models']);

function normalizedCustomExtensions(value) {
  const values = Array.isArray(value) ? value : String(value || '').split(/[\s,;]+/);
  return [...new Set(values.map((item) => String(item).trim().toLowerCase()).filter(Boolean).map((item) => item.startsWith('.') ? item : `.${item}`).filter((item) => /^\.[a-z0-9][a-z0-9+_-]{0,15}$/i.test(item)))];
}

function normalizedIndexCategories(value) {
  if (!Array.isArray(value)) return [...DEFAULT_INDEX_CATEGORIES];
  return [...new Set(value.filter((category) => Object.hasOwn(FILE_TYPE_GROUPS, category)))];
}

function configuredIndexExtensions(preferences = {}) {
  return new Set([...extensionSet(normalizedIndexCategories(preferences.indexFileCategories)), ...normalizedCustomExtensions(preferences.indexCustomExtensions)]);
}

function shouldIndexFile(filePath, preferences = {}) {
  if (preferences.indexAllFiles === true) return true;
  const extension = path.extname(String(filePath || '')).toLowerCase();
  return Boolean(extension && configuredIndexExtensions(preferences).has(extension));
}

function dialogExtensions(preferences = {}) {
  return [...configuredIndexExtensions(preferences)].map((extension) => extension.slice(1)).sort();
}

function indexingPolicySignature(preferences = {}) {
  return JSON.stringify({ all: preferences.indexAllFiles === true, categories: normalizedIndexCategories(preferences.indexFileCategories).sort(), custom: normalizedCustomExtensions(preferences.indexCustomExtensions).sort() });
}

module.exports = { FILE_TYPE_GROUPS, DEFAULT_INDEX_CATEGORIES, IMAGE_EXTENSIONS, RAW_IMAGE_EXTENSIONS, RAW_IMAGE_EXTENSION_SET, HEIC_IMAGE_EXTENSIONS, HEIC_IMAGE_EXTENSION_SET, VIDEO_EXTENSIONS, AUDIO_EXTENSIONS, FONT_EXTENSIONS, DOCUMENT_EXTENSIONS, normalizedCustomExtensions, normalizedIndexCategories, configuredIndexExtensions, shouldIndexFile, dialogExtensions, indexingPolicySignature };
