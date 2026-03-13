# DocSight

> 🔍 Document Intelligence Workbench — Powered by [Kreuzberg](https://kreuzberg.dev)

A modern web application for extracting text, metadata, and structured information from documents. Upload PDFs, Office files, images, and 76+ formats — get instant results with OCR support.

![DocSight Screenshot](docs/screenshot.png)

## ✨ Features

- **🗂️ Drag & Drop Upload** — Multi-file drag-and-drop with queue management
- **📄 Text Extraction** — Plain Text, Markdown, or HTML output formats
- **🔍 OCR Recognition** — Tesseract + PaddleOCR dual backend, 10 languages
- **📊 Batch Processing** — Sequential file processing with real-time progress
- **📋 Rich Results** — Three-tab viewer (Content / Metadata / Tables)
- **💾 Export** — Download as TXT, Markdown, or JSON; copy to clipboard
- **⚙️ 76+ Formats** — PDF, DOCX, XLSX, PPTX, PNG, JPG, HTML, ZIP, and more

## 🏗️ Architecture

```
DocSight (Nginx, Port 3070)
├── /       → Static SPA (HTML/CSS/JS)
└── /api/   → Reverse Proxy → Kreuzberg API (Port 8000)
```

| Component | Technology |
|-----------|-----------|
| Frontend  | Vanilla HTML/CSS/JS (ES Modules) |
| Backend   | [Kreuzberg](https://github.com/kreuzberg-dev/kreuzberg) v4.4.2 REST API |
| Server    | Nginx Alpine |
| Deploy    | Docker Compose |

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Kreuzberg API container running (or use the bundled `docker-compose.yaml`)

### Deploy

```bash
git clone <repo-url> docsight
cd docsight
docker compose up -d
```

The app will be available at `http://localhost:3070`.

### Development

For local development without Docker:

```bash
# Start a simple HTTP server
cd src
python3 -m http.server 3070

# You'll need to configure CORS or use a proxy for API calls
```

## 📁 Project Structure

```
doc_api/
├── src/
│   ├── index.html          # Main page
│   ├── css/style.css       # Design system (Dark Navy + Cyan)
│   └── js/
│       ├── app.js          # Application entry point
│       ├── api.js          # Kreuzberg API client
│       ├── upload.js       # Drag & drop + queue manager
│       └── viewer.js       # Result renderer + export
├── nginx.conf              # Nginx reverse proxy config
├── Dockerfile              # Frontend container
├── docker-compose.yaml     # Full stack orchestration
└── AGENTS.md               # AI agent anchor (ANWS)
```

## 🔧 Configuration

### Nginx

The `nginx.conf` is pre-configured with:
- 500MB upload limit (`client_max_body_size`)
- 300s proxy timeout (for large file OCR)
- Gzip compression for static assets
- 7-day browser cache for CSS/JS/fonts

### Kreuzberg API

Environment variables in `docker-compose.yaml`:
- `KREUZBERG_MAX_UPLOAD_SIZE_MB=500`
- `RUST_LOG=info`

## 📋 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/extract` | Extract text from uploaded files |
| `POST` | `/api/chunk` | Chunk text into segments |
| `POST` | `/api/embed` | Generate text embeddings |
| `GET` | `/api/health` | Health check |
| `GET` | `/api/info` | Server info |
| `GET` | `/api/formats` | List supported formats |
| `GET` | `/api/cache/stats` | Cache statistics |
| `DELETE` | `/api/cache/clear` | Clear cache |

## 📜 License

MIT
