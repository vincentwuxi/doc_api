/**
 * DocSight — Kreuzberg API Client
 * Wraps all Kreuzberg REST API endpoints
 */

const API_BASE = '/api';

export const KreuzbergAPI = {
  /**
   * Health check
   * @returns {Promise<{status: string, version: string, plugins: object}>}
   */
  async health() {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
    return res.json();
  },

  /**
   * Server info
   * @returns {Promise<{version: string, rust_backend: boolean}>}
   */
  async info() {
    const res = await fetch(`${API_BASE}/info`);
    if (!res.ok) throw new Error(`Info request failed: ${res.status}`);
    return res.json();
  },

  /**
   * Get supported formats
   * @returns {Promise<Array<{extension: string, mime_type: string}>>}
   */
  async formats() {
    const res = await fetch(`${API_BASE}/formats`);
    if (!res.ok) throw new Error(`Formats request failed: ${res.status}`);
    return res.json();
  },

  /**
   * Extract text from file(s)
   * @param {File[]} files - Files to extract
   * @param {object} [options] - Extraction options
   * @param {string} [options.outputFormat='plain'] - plain|markdown|html|djot
   * @param {boolean} [options.forceOcr=false] - Force OCR
   * @param {string} [options.ocrLanguage='eng'] - OCR language
   * @param {AbortSignal} [options.signal] - Abort signal
   * @param {function} [options.onProgress] - Upload progress callback (0-1)
   * @returns {Promise<Array<object>>}
   */
  async extract(files, options = {}) {
    const {
      outputFormat = 'plain',
      forceOcr = false,
      ocrLanguage = 'eng',
      signal,
      onProgress,
    } = options;

    const formData = new FormData();
    for (const file of files) {
      formData.append('files', file);
    }

    // Build config
    const config = {};
    if (forceOcr) {
      config.force_ocr = true;
    }
    if (ocrLanguage && ocrLanguage !== 'eng') {
      config.ocr = { language: ocrLanguage };
    }
    if (Object.keys(config).length > 0) {
      formData.append('config', JSON.stringify(config));
    }
    if (outputFormat !== 'plain') {
      formData.append('output_format', outputFormat);
    }

    // Use XMLHttpRequest for progress tracking
    if (onProgress) {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API_BASE}/extract`);

        if (signal) {
          signal.addEventListener('abort', () => xhr.abort());
        }

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            onProgress(e.loaded / e.total);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              resolve(JSON.parse(xhr.responseText));
            } catch {
              reject(new Error('Invalid JSON response'));
            }
          } else {
            try {
              const err = JSON.parse(xhr.responseText);
              reject(new Error(err.error || `Extraction failed: ${xhr.status}`));
            } catch {
              reject(new Error(`Extraction failed: ${xhr.status}`));
            }
          }
        });

        xhr.addEventListener('error', () => reject(new Error('Network error')));
        xhr.addEventListener('abort', () => reject(new Error('Extraction aborted')));
        xhr.send(formData);
      });
    }

    // Simple fetch for no-progress case
    const res = await fetch(`${API_BASE}/extract`, {
      method: 'POST',
      body: formData,
      signal,
    });

    if (res.status === 413) {
      throw new Error('File too large. Maximum upload size is 500MB.');
    }

    if (!res.ok) {
      let errMsg = `Extraction failed: ${res.status}`;
      try {
        const err = await res.json();
        errMsg = err.error || errMsg;
      } catch {}
      throw new Error(errMsg);
    }

    return res.json();
  },

  /**
   * Chunk text
   * @param {string} text - Text to chunk
   * @param {object} [config] - Chunking config
   * @returns {Promise<object>}
   */
  async chunk(text, config = {}) {
    const res = await fetch(`${API_BASE}/chunk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, ...config }),
    });
    if (!res.ok) throw new Error(`Chunking failed: ${res.status}`);
    return res.json();
  },

  /**
   * Get cache stats
   * @returns {Promise<object>}
   */
  async cacheStats() {
    const res = await fetch(`${API_BASE}/cache/stats`);
    if (!res.ok) throw new Error(`Cache stats failed: ${res.status}`);
    return res.json();
  },

  /**
   * Clear cache
   * @returns {Promise<object>}
   */
  async cacheClear() {
    const res = await fetch(`${API_BASE}/cache/clear`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Cache clear failed: ${res.status}`);
    return res.json();
  },
};
