/**
 * DocSight — Result Viewer & Export
 * Display extraction results, metadata, tables, and handle exports
 */

/** Sanitize HTML to prevent XSS */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Render extracted text content
 */
export function renderTextContent(container, result, outputFormat) {
  if (!result || !result.content) {
    container.innerHTML = '<p class="empty-hint" style="color: var(--color-text-tertiary); font-style: italic;">No text content extracted.</p>';
    return;
  }

  const content = result.content;

  if (outputFormat === 'html') {
    // For HTML output, render directly but sanitize script tags
    const sanitized = content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    container.innerHTML = `<div class="result-text markdown">${sanitized}</div>`;
  } else if (outputFormat === 'markdown') {
    // Simple markdown rendering
    container.innerHTML = `<div class="result-text markdown">${renderMarkdown(content)}</div>`;
  } else {
    // Plain text
    container.innerHTML = `<pre class="result-text">${escapeHtml(content)}</pre>`;
  }
}

/**
 * Simple Markdown renderer
 */
function renderMarkdown(md) {
  let html = escapeHtml(md);

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold & Italic
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Code blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/gs, '<ul>$&</ul>');

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  // Tables (basic)
  html = html.replace(/^\|(.+)\|$/gm, (match, content) => {
    const cells = content.split('|').map(c => c.trim());
    if (cells.every(c => /^[-:]+$/.test(c))) return ''; // separator row
    const tag = 'td';
    return '<tr>' + cells.map(c => `<${tag}>${c}</${tag}>`).join('') + '</tr>';
  });
  html = html.replace(/(<tr>.*<\/tr>\n?)+/gs, '<table>$&</table>');

  // Paragraphs (lines not already wrapped)
  html = html.replace(/^(?!<[huplitao])(.*\S.*)$/gm, '<p>$1</p>');

  // Clean empty paragraphs
  html = html.replace(/<p><\/p>/g, '');

  return html;
}

/**
 * Render metadata panel
 */
export function renderMetadata(container, result) {
  if (!result || !result.metadata) {
    container.innerHTML = '<p style="color: var(--color-text-tertiary); font-style: italic;">No metadata available.</p>';
    return;
  }

  const meta = result.metadata;
  const cards = [];

  // Basic Info
  const basicItems = [];
  if (result.mime_type) basicItems.push(['MIME Type', result.mime_type]);
  if (meta.title) basicItems.push(['Title', meta.title]);
  if (meta.author) basicItems.push(['Author', meta.author]);
  if (meta.created_at) basicItems.push(['Created', formatDate(meta.created_at)]);
  if (meta.modified_at) basicItems.push(['Modified', formatDate(meta.modified_at)]);
  if (meta.page_count) basicItems.push(['Pages', meta.page_count]);
  if (meta.word_count) basicItems.push(['Words', meta.word_count.toLocaleString()]);
  if (meta.char_count) basicItems.push(['Characters', meta.char_count.toLocaleString()]);

  if (basicItems.length > 0) {
    cards.push(renderMetadataCard('Document Info', fileInfoIcon(), basicItems));
  }

  // Quality Score
  if (result.quality_score != null) {
    const score = (result.quality_score * 100).toFixed(1);
    cards.push(renderMetadataCard('Quality', qualityIcon(), [
      ['Quality Score', `${score}%`],
    ]));
  }

  // Processing Warnings
  if (result.processing_warnings && result.processing_warnings.length > 0) {
    const warningItems = result.processing_warnings.map((w, i) => [`Warning ${i + 1}`, w.message || w]);
    cards.push(renderMetadataCard('Warnings', warningIcon(), warningItems));
  }

  // Additional metadata
  if (meta.additional && Object.keys(meta.additional).length > 0) {
    const addItems = Object.entries(meta.additional).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v)]);
    cards.push(renderMetadataCard('Additional', additionalIcon(), addItems));
  }

  container.innerHTML = `<div class="metadata-panel">${cards.join('')}</div>`;
}

function renderMetadataCard(title, iconSvg, items) {
  const rows = items.map(([key, value]) =>
    `<div class="metadata-item">
      <span class="metadata-key">${escapeHtml(key)}</span>
      <span class="metadata-value">${escapeHtml(String(value))}</span>
    </div>`
  ).join('');

  return `
    <div class="metadata-card">
      <h4>${iconSvg} ${escapeHtml(title)}</h4>
      ${rows}
    </div>`;
}

/**
 * Render extracted tables
 */
export function renderTables(container, result) {
  if (!result || !result.tables || result.tables.length === 0) {
    container.innerHTML = '<p style="color: var(--color-text-tertiary); font-style: italic;">No tables detected in this document.</p>';
    return;
  }

  const tablesHtml = result.tables.map((table, i) => {
    let tableContent = '';
    if (table.rows && table.rows.length > 0) {
      const headerRow = table.rows[0];
      const dataRows = table.rows.slice(1);

      const headerCells = headerRow.map(cell => `<th>${escapeHtml(String(cell))}</th>`).join('');
      const bodyRows = dataRows.map(row =>
        '<tr>' + row.map(cell => `<td>${escapeHtml(String(cell))}</td>`).join('') + '</tr>'
      ).join('');

      tableContent = `
        <table>
          <thead><tr>${headerCells}</tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>`;
    } else if (table.content) {
      tableContent = `<pre class="result-text">${escapeHtml(table.content)}</pre>`;
    }

    return `
      <div class="extracted-table">
        <h4>Table ${i + 1}${table.title ? ': ' + escapeHtml(table.title) : ''}</h4>
        ${tableContent}
      </div>`;
  }).join('');

  container.innerHTML = `<div class="tables-panel">${tablesHtml}</div>`;
}

/**
 * Export result content
 */
export function exportResult(result, format, fileName) {
  if (!result) return;

  let content, mime, ext;

  switch (format) {
    case 'txt':
      content = result.content || '';
      mime = 'text/plain';
      ext = '.txt';
      break;
    case 'md':
      content = result.content || '';
      mime = 'text/markdown';
      ext = '.md';
      break;
    case 'json':
      content = JSON.stringify(result, null, 2);
      mime = 'application/json';
      ext = '.json';
      break;
    default:
      return;
  }

  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (fileName || 'export') + ext;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* --- Helper Icons (inline SVG) --- */
function fileInfoIcon() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>';
}
function qualityIcon() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';
}
function warningIcon() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
}
function additionalIcon() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
}

function formatDate(dateStr) {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}
