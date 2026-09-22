# Veritas AI - Plagiarism & Originality Checker

A modern, responsive, and easy-to-use Plagiarism and Originality Detection web application with multimodal OCR image upload support, powered by React, Vite, and an in-browser NLP Detection Engine.

## ✨ Highlights & Features
- **🚀 100% Free & Zero API Key Setup**: Open the website and scan instantly. No Google Gemini API key or signup required.
- **🔍 Multi-Layer Plagiarism Engine**:
  - N-gram shingle fingerprinting and winnowing algorithm to detect exact phrase copying.
  - Real-time Wikipedia and Open Web knowledge cross-referencing.
  - Pre-indexed academic papers, literature, speeches, and scientific definitions corpus.
  - Paraphrasing and synonym-substitution detection via Jaccard and Levenshtein metrics.
  - AI Stylometry & Perplexity/Burstiness detector (Type-Token ratio, sentence length variance, AI marker words).
- **📸 In-Browser Multimodal OCR**: Drag and drop photos or screenshots of documents/assignments (JPEG, PNG, WebP) with client-side OCR extraction.
- **⚖️ Side-by-Side Comparator**: Directly compare two documents or submissions to find overlapping phrases and calculate similarity percentages.
- **📄 PDF Report Generator**: Export professional Originality Certificates and diagnostic reports with one click.
- **🔎 Sentence-by-Sentence Breakdown**: Interactive color-coded breakdown with clickable diagnosis, citations, and suggested rewrite fixes.
- **🕒 Local Scan History**: Retains past scans locally in your browser for easy reference.

## 🛠️ Getting Started

### 1. Installation
```bash
npm install
```

### 2. Development Server
Start the local development server:
```bash
npm run dev
```
The application will run at `http://localhost:3000`.

### 3. Build for Production
```bash
npm run build
```
