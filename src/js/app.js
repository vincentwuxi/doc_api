/**
 * DocSight — Main Application
 * Orchestrates upload, processing, and result display
 */

import { KreuzbergAPI } from './api.js';
import { UploadManager, setupDragAndDrop, STATUS, formatFileSize } from './upload.js';
import { renderTextContent, renderMetadata, renderTables, exportResult } from './viewer.js';

/* ============================
   State
   ============================ */
let selectedFileId = null;
let supportedFormats = [];
let serverVersion = '';

/* ============================
   DOM References
   ============================ */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

/* ============================
   Toast Notifications
   ============================ */
function showToast(message, type = 'info') {
  const container = $('#toast-container');
  const iconMap = {
    success: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    error: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    info: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    ${iconMap[type]}
    <span class="toast-message">${message}</span>
    <button class="toast-close" aria-label="Close">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  `;

  toast.querySelector('.toast-close').addEventListener('click', () => dismissToast(toast));
  container.appendChild(toast);

  setTimeout(() => dismissToast(toast), 5000);
}

function dismissToast(toast) {
  if (!toast.parentElement) return;
  toast.classList.add('leaving');
  setTimeout(() => toast.remove(), 200);
}

/* ============================
   Upload Manager Setup
   ============================ */
const uploadMgr = new UploadManager({
  onFileAdded(entry) {
    renderFileItem(entry);
    updateEmptyState();
    updateStats();
    updateProcessButton();
  },
  onFileUpdated(entry) {
    updateFileItem(entry);
    updateStats();
    // Auto-select first completed file
    if (entry.status === STATUS.DONE && selectedFileId === null) {
      selectFile(entry.id);
    }
    if (entry.status === STATUS.ERROR) {
      showToast(`Failed to process ${entry.file.name}: ${entry.error}`, 'error');
    }
  },
  onFileRemoved(id) {
    const el = document.querySelector(`.file-item[data-id="${id}"]`);
    if (el) el.remove();
    if (selectedFileId === id) {
      selectedFileId = null;
      showEmptyResult();
    }
    updateEmptyState();
    updateStats();
    updateProcessButton();
  },
  onProcessingComplete() {
    updateProcessButton();
    const stats = uploadMgr.getStats();
    if (stats.done > 0) {
      showToast(`Processed ${stats.done} file${stats.done > 1 ? 's' : ''} successfully!`, 'success');
    }
  },
});

/* ============================
   File List Rendering
   ============================ */
function renderFileItem(entry) {
  const queue = $('#file-queue');
  const emptyEl = queue.querySelector('.file-queue-empty');
  if (emptyEl) emptyEl.remove();

  const div = document.createElement('div');
  div.className = 'file-item';
  div.dataset.id = entry.id;

  div.innerHTML = `
    <div class="file-icon ${entry.iconClass}">${entry.ext.toUpperCase().slice(0, 4)}</div>
    <div class="file-info">
      <div class="file-name" title="${entry.file.name}">${entry.file.name}</div>
      <div class="file-meta">
        <span>${formatFileSize(entry.file.size)}</span>
      </div>
    </div>
    <div class="file-status">
      <span class="file-status-badge pending">Pending</span>
    </div>
    <button class="file-remove" title="Remove" aria-label="Remove file">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
    <div class="file-progress" style="width: 0%"></div>
  `;

  div.addEventListener('click', (e) => {
    if (e.target.closest('.file-remove')) {
      uploadMgr.removeFile(entry.id);
      return;
    }
    selectFile(entry.id);
  });

  queue.appendChild(div);
}

function updateFileItem(entry) {
  const el = document.querySelector(`.file-item[data-id="${entry.id}"]`);
  if (!el) return;

  const badge = el.querySelector('.file-status-badge');
  badge.className = `file-status-badge ${entry.status}`;
  const labels = { pending: 'Pending', processing: 'Processing…', done: 'Done', error: 'Error' };
  badge.textContent = labels[entry.status] || entry.status;

  const progress = el.querySelector('.file-progress');
  if (entry.status === STATUS.PROCESSING) {
    progress.style.width = `${Math.round(entry.progress * 100)}%`;
    el.classList.add('processing');
  } else {
    progress.style.width = entry.status === STATUS.DONE ? '100%' : '0%';
    el.classList.remove('processing');
    // Fade progress bar out after done
    if (entry.status === STATUS.DONE) {
      setTimeout(() => { progress.style.opacity = '0'; }, 600);
    }
  }

  // Re-render result if this is the selected file
  if (selectedFileId === entry.id && entry.status === STATUS.DONE) {
    renderResult(entry);
  }
}

function selectFile(id) {
  // Update selection UI
  $$('.file-item').forEach(el => el.classList.remove('active'));
  const el = document.querySelector(`.file-item[data-id="${id}"]`);
  if (el) el.classList.add('active');

  selectedFileId = id;
  const entry = uploadMgr.files.get(id);
  if (entry && entry.status === STATUS.DONE) {
    renderResult(entry);
  } else if (entry && entry.status === STATUS.ERROR) {
    showErrorResult(entry);
  } else {
    showPendingResult(entry);
  }
}

/* ============================
   Result Display
   ============================ */
function renderResult(entry) {
  const main = $('#app-main');
  const options = uploadMgr.getOptions();

  main.innerHTML = `
    <div class="result-header">
      <div class="result-title">
        <h2>${escapeAttr(entry.file.name)}</h2>
        <span class="file-type-badge">${entry.ext}</span>
      </div>
      <div class="result-actions">
        <button class="btn btn-secondary" id="export-txt" title="Export as TXT">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          TXT
        </button>
        <button class="btn btn-secondary" id="export-md" title="Export as Markdown">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          MD
        </button>
        <button class="btn btn-secondary" id="export-json" title="Export as JSON">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          JSON
        </button>
        <button class="btn btn-secondary" id="copy-text" title="Copy to clipboard">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
          Copy
        </button>
      </div>
    </div>
    <div class="result-tabs">
      <button class="result-tab active" data-tab="content">Content</button>
      <button class="result-tab" data-tab="metadata">Metadata</button>
      <button class="result-tab" data-tab="tables">Tables${entry.result?.tables?.length ? ` (${entry.result.tables.length})` : ''}</button>
    </div>
    <div class="result-content" id="result-content-area"></div>
  `;

  const contentArea = $('#result-content-area');

  // Tab switching
  $$('.result-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.result-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const tabName = tab.dataset.tab;
      if (tabName === 'content') renderTextContent(contentArea, entry.result, options.outputFormat);
      else if (tabName === 'metadata') renderMetadata(contentArea, entry.result);
      else if (tabName === 'tables') renderTables(contentArea, entry.result);
    });
  });

  // Render content tab by default
  renderTextContent(contentArea, entry.result, options.outputFormat);

  // Export handlers
  const baseName = entry.file.name.replace(/\.[^.]+$/, '');
  $('#export-txt')?.addEventListener('click', () => exportResult(entry.result, 'txt', baseName));
  $('#export-md')?.addEventListener('click', () => exportResult(entry.result, 'md', baseName));
  $('#export-json')?.addEventListener('click', () => exportResult(entry.result, 'json', baseName));
  $('#copy-text')?.addEventListener('click', () => {
    navigator.clipboard.writeText(entry.result?.content || '').then(() => {
      showToast('Copied to clipboard!', 'success');
    }).catch(() => {
      showToast('Failed to copy text', 'error');
    });
  });
}

function showEmptyResult() {
  const main = $('#app-main');
  main.innerHTML = `
    <div class="empty-state">
      <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <path d="M12 18v-6"/>
        <path d="M9 15l3 3 3-3"/>
      </svg>
      <h2>Upload documents to get started</h2>
      <p>Drag & drop files into the sidebar, or click the upload zone. Supports PDF, Office documents, images, and 76+ formats.</p>
    </div>
  `;
}

function showPendingResult(entry) {
  const main = $('#app-main');
  main.innerHTML = `
    <div class="empty-state">
      <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.5">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
      <h2>${entry ? 'Waiting to process' : 'Select a file'}</h2>
      <p>${entry ? `Click "Extract All" to start processing ${entry.file.name}` : 'Click on a completed file to view its results.'}</p>
    </div>
  `;
}

function showErrorResult(entry) {
  const main = $('#app-main');
  main.innerHTML = `
    <div class="empty-state">
      <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" stroke-width="1.5" style="opacity:0.7">
        <circle cx="12" cy="12" r="10"/>
        <line x1="15" y1="9" x2="9" y2="15"/>
        <line x1="9" y1="9" x2="15" y2="15"/>
      </svg>
      <h2>Processing Failed</h2>
      <p style="color: var(--color-danger);">${entry?.error || 'Unknown error'}</p>
    </div>
  `;
}

/* ============================
   UI Updates
   ============================ */
function updateEmptyState() {
  const queue = $('#file-queue');
  if (uploadMgr.files.size === 0) {
    if (!queue.querySelector('.file-queue-empty')) {
      queue.innerHTML = `
        <div class="file-queue-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/>
            <polyline points="13 2 13 9 20 9"/>
          </svg>
          <p>No files in queue</p>
        </div>
      `;
    }
    showEmptyResult();
  }
}

function updateStats() {
  const stats = uploadMgr.getStats();
  const statsBar = $('#stats-bar');
  if (stats.total === 0) {
    statsBar.classList.add('hidden');
    return;
  }
  statsBar.classList.remove('hidden');
  statsBar.innerHTML = `
    <div class="stat-item">Files: <span class="stat-value">${stats.total}</span></div>
    <div class="stat-item">Done: <span class="stat-value">${stats.done}</span></div>
    ${stats.errors > 0 ? `<div class="stat-item">Errors: <span class="stat-value" style="color:var(--color-danger)">${stats.errors}</span></div>` : ''}
    <div class="stat-item">Size: <span class="stat-value">${formatFileSize(stats.totalSize)}</span></div>
  `;
}

function updateProcessButton() {
  const btn = $('#btn-extract');
  const stats = uploadMgr.getStats();

  if (uploadMgr.isProcessing) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Processing…';
  } else if (stats.pending > 0) {
    btn.disabled = false;
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
        <polygon points="5 3 19 12 5 21 5 3"/>
      </svg>
      Extract All (${stats.pending})
    `;
  } else {
    btn.disabled = true;
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
        <polygon points="5 3 19 12 5 21 5 3"/>
      </svg>
      Extract All
    `;
  }
}

function escapeAttr(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ============================
   System Info / Formats Modal
   ============================ */
async function showFormatsModal() {
  if (supportedFormats.length === 0) {
    try {
      supportedFormats = await KreuzbergAPI.formats();
    } catch {
      showToast('Failed to load formats', 'error');
      return;
    }
  }

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>Supported Formats (${supportedFormats.length})</h3>
        <button class="btn-icon modal-close" aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="modal-body">
        <div class="formats-grid">
          ${supportedFormats.map(f => `<span class="format-tag">.${f.extension}</span>`).join('')}
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary modal-close">Close</button>
      </div>
    </div>
  `;

  overlay.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => overlay.remove());
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  document.body.appendChild(overlay);
}

/* ============================
   Init
   ============================ */
async function init() {
  // Setup drag & drop
  const uploadZone = $('#upload-zone');
  const fileInput = $('#file-input');

  setupDragAndDrop(uploadZone, fileInput, (files) => {
    uploadMgr.addFiles(files);
  });

  // Extract button
  $('#btn-extract').addEventListener('click', () => {
    uploadMgr.processAll();
    updateProcessButton();
  });

  // Clear button
  $('#btn-clear').addEventListener('click', () => {
    uploadMgr.clearAll();
    const queue = $('#file-queue');
    queue.innerHTML = '';
    selectedFileId = null;
    updateEmptyState();
    updateStats();
    updateProcessButton();
  });

  // Formats button
  $('#btn-formats').addEventListener('click', showFormatsModal);

  // Initial UI
  updateEmptyState();
  updateStats();
  updateProcessButton();

  // Check API health
  try {
    const health = await KreuzbergAPI.health();
    serverVersion = health.version;
    $('#status-dot').classList.add('online');
    $('#status-text').textContent = `v${health.version}`;
    $('#version-badge').textContent = `API v${health.version}`;

    // Pre-load formats
    supportedFormats = await KreuzbergAPI.formats();
  } catch (err) {
    $('#status-dot').classList.add('offline');
    $('#status-text').textContent = 'Offline';
    showToast('Cannot connect to Kreuzberg API. Check server status.', 'error');
  }
}

// Start app
document.addEventListener('DOMContentLoaded', init);
