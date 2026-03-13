/**
 * DocSight — Upload Manager
 * Drag & drop, file queue, batch processing
 */

import { KreuzbergAPI } from './api.js';

/** File processing states */
const STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  DONE: 'done',
  ERROR: 'error',
};

/** Map extension to icon class */
function getFileIconClass(ext) {
  const map = {
    pdf: 'pdf',
    doc: 'doc', docx: 'doc', odt: 'doc', rtf: 'doc',
    xls: 'xls', xlsx: 'xls', xlsm: 'xls', ods: 'xls', csv: 'xls',
    ppt: 'doc', pptx: 'doc', ppsx: 'doc',
    png: 'img', jpg: 'img', jpeg: 'img', gif: 'img', bmp: 'img',
    tiff: 'img', tif: 'img', webp: 'img', svg: 'img',
    zip: 'zip', '7z': 'zip', tar: 'zip', gz: 'zip', tgz: 'zip',
  };
  return map[ext] || '';
}

function getFileExtension(name) {
  const parts = name.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
}

let fileId = 0;

export class UploadManager {
  constructor({ onFileAdded, onFileUpdated, onFileRemoved, onProcessingComplete }) {
    /** @type {Map<number, {id: number, file: File, status: string, progress: number, result: object|null, error: string|null, abortCtrl: AbortController|null}>} */
    this.files = new Map();
    this.callbacks = { onFileAdded, onFileUpdated, onFileRemoved, onProcessingComplete };
    this.isProcessing = false;
  }

  /**
   * Add files to queue
   * @param {FileList|File[]} fileList
   */
  addFiles(fileList) {
    for (const file of fileList) {
      const id = ++fileId;
      const entry = {
        id,
        file,
        ext: getFileExtension(file.name),
        iconClass: getFileIconClass(getFileExtension(file.name)),
        status: STATUS.PENDING,
        progress: 0,
        result: null,
        error: null,
        abortCtrl: null,
      };
      this.files.set(id, entry);
      this.callbacks.onFileAdded?.(entry);
    }
  }

  /**
   * Remove file from queue
   */
  removeFile(id) {
    const entry = this.files.get(id);
    if (!entry) return;
    if (entry.abortCtrl) entry.abortCtrl.abort();
    this.files.delete(id);
    this.callbacks.onFileRemoved?.(id);
  }

  /**
   * Clear all files
   */
  clearAll() {
    for (const [id, entry] of this.files) {
      if (entry.abortCtrl) entry.abortCtrl.abort();
    }
    this.files.clear();
  }

  /**
   * Get extraction options from the current UI state
   */
  getOptions() {
    const formatSelect = document.getElementById('output-format');
    const langSelect = document.getElementById('ocr-language');
    const forceOcrBtn = document.getElementById('force-ocr');

    return {
      outputFormat: formatSelect?.value || 'plain',
      ocrLanguage: langSelect?.value || 'eng',
      forceOcr: forceOcrBtn?.classList.contains('active') || false,
    };
  }

  /**
   * Process all pending files
   */
  async processAll() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    const pending = [...this.files.values()].filter(f => f.status === STATUS.PENDING);
    if (pending.length === 0) {
      this.isProcessing = false;
      return;
    }

    const options = this.getOptions();

    // Process files one by one (to show individual progress)
    for (const entry of pending) {
      if (!this.files.has(entry.id)) continue; // removed during processing

      entry.status = STATUS.PROCESSING;
      entry.progress = 0;
      entry.abortCtrl = new AbortController();
      this.callbacks.onFileUpdated?.(entry);

      try {
        const results = await KreuzbergAPI.extract([entry.file], {
          ...options,
          signal: entry.abortCtrl.signal,
          onProgress: (pct) => {
            entry.progress = pct;
            this.callbacks.onFileUpdated?.(entry);
          },
        });

        entry.status = STATUS.DONE;
        entry.progress = 1;
        entry.result = results[0] || null;
        entry.abortCtrl = null;
      } catch (err) {
        if (err.message === 'Extraction aborted') {
          // File was removed, skip
          continue;
        }
        entry.status = STATUS.ERROR;
        entry.error = err.message;
        entry.abortCtrl = null;
      }

      this.callbacks.onFileUpdated?.(entry);
    }

    this.isProcessing = false;
    this.callbacks.onProcessingComplete?.();
  }

  /**
   * Get stats
   */
  getStats() {
    let total = 0, pending = 0, processing = 0, done = 0, errors = 0, totalSize = 0;
    for (const entry of this.files.values()) {
      total++;
      totalSize += entry.file.size;
      if (entry.status === STATUS.PENDING) pending++;
      else if (entry.status === STATUS.PROCESSING) processing++;
      else if (entry.status === STATUS.DONE) done++;
      else if (entry.status === STATUS.ERROR) errors++;
    }
    return { total, pending, processing, done, errors, totalSize };
  }
}

/* --- DnD Setup --- */
export function setupDragAndDrop(zone, fileInput, onFilesSelected) {
  // Click to upload
  zone.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      onFilesSelected(e.target.files);
      fileInput.value = '';
    }
  });

  // Drag events
  let dragCounter = 0;

  zone.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    zone.classList.add('drag-over');
  });

  zone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      zone.classList.remove('drag-over');
    }
  });

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    dragCounter = 0;
    zone.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) {
      onFilesSelected(e.dataTransfer.files);
    }
  });
}

/* Export helpers */
export { STATUS, formatFileSize, getFileExtension, getFileIconClass };
