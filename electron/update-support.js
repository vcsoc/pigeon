'use strict';

function errorMessages(error) {
  const messages = [];
  const seen = new Set();
  let current = error;
  while (current && !seen.has(current)) {
    seen.add(current);
    if (current.message) messages.push(String(current.message));
    current = current.cause;
  }
  return messages.join('\n');
}

function isMissingUpdateMetadataError(error) {
  const message = errorMessages(error);
  const namesUpdateMetadata = /(?:latest|[a-z0-9_-]+)-(?:mac|linux)\.ya?ml|(?:^|\/)latest\.ya?ml/i.test(message);
  return namesUpdateMetadata && (/cannot find/i.test(message) || /(?:http|status)[^\n]*404|\b404\b/i.test(message));
}

module.exports = { isMissingUpdateMetadataError };
