(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PigeonRenameSession = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function createRenameSession() {
    let current = null;
    return {
      begin(assetId, value) { current = assetId ? { assetId: String(assetId), value: String(value || '') } : null; return current && { ...current }; },
      update(value) { if (current) current.value = String(value || ''); },
      snapshot() { return current && { ...current }; },
      clear() { const previous = current && { ...current }; current = null; return previous; }
    };
  }
  return { createRenameSession };
});
