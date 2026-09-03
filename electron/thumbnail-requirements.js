'use strict';

function rawCameraProxyRequired(asset, extension, rawExtensions) {
  if (!rawExtensions.has(String(extension || '').toLowerCase())) return false;
  const detectedFormat = String(asset?.technicalMetadata?.format || '').toLowerCase();
  return !detectedFormat || detectedFormat === 'camera-raw';
}

module.exports = { rawCameraProxyRequired };
