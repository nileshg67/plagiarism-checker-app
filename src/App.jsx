import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Download,
  Trash2,
  RefreshCw,
  ExternalLink,
  Search,
  BookOpen,
  Eye,
  Check,
  Zap,
  Clock,
  ArrowRightLeft,
  ShieldCheck,
  BookMarked,
  Sparkles,
  AlignLeft,
  X,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  CheckCheck,
  ArrowDown,
  Layers,
  FileSearch,
  Cpu,
  GraduationCap
} from 'lucide-react';

import { analyzePlagiarism, compareTwoTexts } from './utils/plagiarismEngine';
import { extractTextFromFile, extractTextFromImage } from './utils/documentParser';
import { exportReportToPdf } from './utils/pdfExport';

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB limit

export default function App() {
  // Mode: 'scan' (Document Scan) | 'compare' (Compare 2 Documents)
  const [activeTab, setActiveTab] = useState('scan');

  // Scroll & Workspace Open States
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const uploadSectionRef = useRef(null);

  // Input states for Scan Mode
  const [inputText, setInputText] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [fileName, setFileName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [removingFileId, setRemovingFileId] = useState(null);

  // Input states for Compare Mode
  const [compareTextA, setCompareTextA] = useState('');
  const [compareTextB, setCompareTextB] = useState('');
  const [compareResult, setCompareResult] = useState(null);

  // Analysis states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scanProgress, setScanProgress] = useState({ stage: '', percent: 0 });
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [readFileProgress, setReadFileProgress] = useState({ stage: '', percent: 0 });
  const [analysisResult, setAnalysisResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Sentence Review Inspector
  const [selectedSentence, setSelectedSentence] = useState(null);
  const [isClosingSentence, setIsClosingSentence] = useState(false);
  const [sentenceFilter, setSentenceFilter] = useState('all'); // 'all' | 'Plagiarized' | 'Paraphrased' | 'Original'

  // Toast System
  const [toast, setToast] = useState(null); // { id, message, isClosing }
  const toastTimeoutRef = useRef(null);

  // Modals
  const [inspectSource, setInspectSource] = useState(null);
  const [isClosingSourceModal, setIsClosingSourceModal] = useState(false);

  const [showInfoModal, setShowInfoModal] = useState(false);
  const [isClosingInfoModal, setIsClosingInfoModal] = useState(false);

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClosingClearConfirm, setIsClosingClearConfirm] = useState(false);

  // History with Accordion & Exit animation
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(true);
  const [removingHistoryId, setRemovingHistoryId] = useState(null);
  const [history, setHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('veritas_history') || '[]');
    } catch {
      return [];
    }
  });

  const fileInputRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('veritas_history', JSON.stringify(history));
  }, [history]);

  // Scroll listener to open upload section and track header blur
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      if (scrollY > 60) {
        setHasScrolled(true);
      } else {
        setHasScrolled(false);
      }

      // Check if user reached upload section
      if (uploadSectionRef.current) {
        const rect = uploadSectionRef.current.getBoundingClientRect();
        if (rect.top <= window.innerHeight * 0.85) {
          setIsUploadOpen(true);
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToUpload = () => {
    setIsUploadOpen(true);
    setTimeout(() => {
      uploadSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  // Toast Handler
  const showToast = (message) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ id: Date.now(), message, isClosing: false });
    toastTimeoutRef.current = setTimeout(() => {
      closeToast();
    }, 2800);
  };

  const closeToast = () => {
    setToast((prev) => (prev ? { ...prev, isClosing: true } : null));
    setTimeout(() => {
      setToast(null);
    }, 220);
  };

  // Modal Handlers
  const openSourceModal = (source) => {
    setIsClosingSourceModal(false);
    setInspectSource(source);
  };

  const closeSourceModal = () => {
    setIsClosingSourceModal(true);
    setTimeout(() => {
      setInspectSource(null);
      setIsClosingSourceModal(false);
    }, 180);
  };

  const openInfoModal = () => {
    setIsClosingInfoModal(false);
    setShowInfoModal(true);
  };

  const closeInfoModal = () => {
    setIsClosingInfoModal(true);
    setTimeout(() => {
      setShowInfoModal(false);
      setIsClosingInfoModal(false);
    }, 180);
  };

  const openClearConfirm = () => {
    setIsClosingClearConfirm(false);
    setShowClearConfirm(true);
  };

  const closeClearConfirm = () => {
    setIsClosingClearConfirm(true);
    setTimeout(() => {
      setShowClearConfirm(false);
      setIsClosingClearConfirm(false);
    }, 180);
  };

  const handleConfirmClear = () => {
    closeClearConfirm();
    setInputText('');
    setUploadedFiles([]);
    setFileName('');
    setAnalysisResult(null);
    setErrorMsg('');
    setSelectedSentence(null);
    showToast('Workspace cleared');
  };

  // Sentence Selection Handler
  const handleSelectSentence = (idx) => {
    if (selectedSentence === idx) {
      handleCloseSentence();
    } else {
      setIsClosingSentence(false);
      setSelectedSentence(idx);
    }
  };

  const handleCloseSentence = () => {
    setIsClosingSentence(true);
    setTimeout(() => {
      setSelectedSentence(null);
      setIsClosingSentence(false);
    }, 180);
  };

  const getFileBadgeInfo = (fname) => {
    const ext = fname.split('.').pop()?.toLowerCase() || '';
    if (ext === 'pdf') {
      return { badge: 'PDF', bg: 'bg-[#ef4444]' };
    }
    if (['doc', 'docx'].includes(ext)) {
      return { badge: 'WORD', bg: 'bg-[#3b82f6]' };
    }
    if (ext === 'odt') {
      return { badge: 'ODT', bg: 'bg-[#f59e0b]' };
    }
    if (ext === 'rtf') {
      return { badge: 'RTF', bg: 'bg-[#06b6d4]' };
    }
    if (['html', 'htm'].includes(ext)) {
      return { badge: 'HTML', bg: 'bg-[#f97316]' };
    }
    if (['png', 'jpg', 'jpeg', 'webp', 'bmp', 'tiff'].includes(ext)) {
      return { badge: 'IMAGE', bg: 'bg-[#8b5cf6]' };
    }
    return { badge: ext.toUpperCase() || 'FILE', bg: 'bg-[#10b981]' };
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Drag and Drop
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processIncomingFiles(files);
      setIsUploadOpen(true);
    }
  };

  const processIncomingFiles = async (filesList) => {
    const rawFiles = Array.from(filesList);
    if (!rawFiles.length) return;

    // Filter files within 500MB limit
    const validFiles = [];
    for (const f of rawFiles) {
      if (f.size > MAX_FILE_SIZE) {
        showToast(`Skipped ${f.name}: Exceeds 500MB maximum limit.`);
      } else {
        validFiles.push(f);
      }
    }

    if (!validFiles.length) {
      setErrorMsg('Selected file(s) exceed the 500MB limit.');
      return;
    }

    setErrorMsg('');
    setIsReadingFile(true);
    setIsUploadOpen(true);

    const newEntries = validFiles.map((file) => {
      const badgeInfo = getFileBadgeInfo(file.name);
      return {
        id: `${file.name}-${Date.now()}-${Math.random()}`,
        file,
        name: file.name,
        sizeFormatted: formatFileSize(file.size),
        badge: badgeInfo.badge,
        badgeBg: badgeInfo.bg,
        extractedText: '',
        status: 'reading'
      };
    });

    setUploadedFiles((prev) => [...prev, ...newEntries]);

    for (const entry of newEntries) {
      setReadFileProgress({ stage: `Reading ${entry.name} (extracting text, charts, diagrams)...`, percent: 30 });
      try {
        const parsed = await extractTextFromFile(entry.file, (p) => {
          setReadFileProgress({ stage: `${entry.name}: ${p.stage}`, percent: p.progress });
        });

        entry.extractedText = parsed.text;
        entry.status = 'ready';
        entry.wordCount = parsed.text.split(/\s+/).filter(Boolean).length;
      } catch (err) {
        entry.status = 'error';
        entry.errorMsg = err.message;
        console.error('File extraction error:', err);
      }
    }

    setUploadedFiles((prev) => {
      const updated = prev.map((item) => {
        const match = newEntries.find((e) => e.id === item.id);
        return match || item;
      });

      const allReady = updated.filter((f) => f.status === 'ready' && f.extractedText);
      if (allReady.length === 1) {
        setInputText(allReady[0].extractedText);
        setFileName(allReady[0].name);
      } else if (allReady.length > 1) {
        const combined = allReady.map((f) => `=== Document: ${f.name} ===\n\n${f.extractedText}`).join('\n\n\n');
        setInputText(combined);
        setFileName(`${allReady.length} documents uploaded`);
      }

      return updated;
    });

    setIsReadingFile(false);
    showToast(`Loaded ${newEntries.length} document(s)`);
  };

  // Remove file with graceful closing animation
  const removeFile = (id) => {
    setRemovingFileId(id);
    setTimeout(() => {
      setUploadedFiles((prev) => {
        const remaining = prev.filter((f) => f.id !== id);
        const allReady = remaining.filter((f) => f.status === 'ready' && f.extractedText);
        if (allReady.length === 0) {
          setInputText('');
          setFileName('');
        } else if (allReady.length === 1) {
          setInputText(allReady[0].extractedText);
          setFileName(allReady[0].name);
        } else {
          setInputText(allReady.map((f) => `=== Document: ${f.name} ===\n\n${f.extractedText}`).join('\n\n\n'));
          setFileName(`${allReady.length} documents uploaded`);
        }
        return remaining;
      });
      setRemovingFileId(null);
      showToast('File removed');
    }, 220);
  };

  const handleFileUpload = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processIncomingFiles(files);
    }
  };

  // Run Plagiarism Scan
  const runPlagiarismScan = async () => {
    let textToAnalyze = inputText.trim();

    if (!textToAnalyze && uploadedFiles.length > 0) {
      const readyTexts = uploadedFiles.filter((f) => f.extractedText).map((f) => f.extractedText);
      textToAnalyze = readyTexts.join('\n\n').trim();
      setInputText(textToAnalyze);
    }

    if (!textToAnalyze) {
      setErrorMsg('Please upload a document or paste text to check for originality.');
      return;
    }

    setIsAnalyzing(true);
    setErrorMsg('');
    setAnalysisResult(null);
    setSelectedSentence(null);
    setSentenceFilter('all');

    try {
      const result = await analyzePlagiarism(textToAnalyze, (prog) => {
        setScanProgress(prog);
      });

      setAnalysisResult(result);

      // Save to local scan history
      const newHistoryItem = {
        id: Date.now(),
        date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }),
        score: result.originalityScore,
        risk: result.plagiarismRisk,
        verdict: result.overallVerdict,
        wordCount: result.wordCount,
        snippet: textToAnalyze.substring(0, 90) + '...',
        fullResult: result
      };
      setHistory((prev) => [newHistoryItem, ...prev.slice(0, 9)]);
      showToast('Analysis completed successfully!');
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'An error occurred during analysis.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Run Side-by-Side Comparison
  const runComparison = () => {
    if (!compareTextA.trim() || !compareTextB.trim()) {
      setErrorMsg('Please enter text into both Document A and Document B.');
      return;
    }
    setErrorMsg('');
    const result = compareTwoTexts(compareTextA, compareTextB);
    setCompareResult(result);
    showToast('Comparison report ready');
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    showToast(`Copied ${label || 'to clipboard'}`);
  };

  const loadFromHistory = (item) => {
    if (item.fullResult) {
      setInputText(item.fullResult.extractedText || '');
      setAnalysisResult(item.fullResult);
      setActiveTab('scan');
      setIsUploadOpen(true);
      showToast('Restored report from history');
      setTimeout(() => {
        uploadSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    }
  };

  const removeHistoryItem = (e, id) => {
    e.stopPropagation();
    setRemovingHistoryId(id);
    setTimeout(() => {
      setHistory((prev) => {
        const next = prev.filter((item) => item.id !== id);
        localStorage.setItem('veritas_history', JSON.stringify(next));
        return next;
      });
      setRemovingHistoryId(null);
      showToast('Report removed from history');
    }, 220);
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('veritas_history');
    showToast('History cleared');
  };

  const getFilteredSentences = () => {
    if (!analysisResult?.sentenceAnalysis) return [];
    if (sentenceFilter === 'all') return analysisResult.sentenceAnalysis;
    return analysisResult.sentenceAnalysis.filter((s) => s.status === sentenceFilter);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Original':
        return (
          <span className="px-2.5 py-1 rounded-md text-xs font-medium inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Original phrasing
          </span>
        );
      case 'AI-Generated':
        return (
          <span className="px-2.5 py-1 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 bg-purple-50 text-purple-800 border border-purple-200 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-purple-600" /> AI-Generated
          </span>
        );
      case 'Paraphrased':
        return (
          <span className="px-2.5 py-1 rounded-md text-xs font-medium inline-flex items-center gap-1.5 bg-amber-50 text-amber-800 border border-amber-200 shadow-sm">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Paraphrased content
          </span>
        );
      case 'Plagiarized':
        return (
          <span className="px-2.5 py-1 rounded-md text-xs font-medium inline-flex items-center gap-1.5 bg-rose-50 text-rose-700 border border-rose-200 shadow-sm">
            <XCircle className="w-3.5 h-3.5 text-rose-600" /> Direct match found
          </span>
        );
      default:
        return null;
    }
  };

  const wordCount = inputText.trim() ? inputText.trim().split(/\s+/).filter(Boolean).length : 0;
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));

  return (
    <div className="min-h-screen flex flex-col font-sans selection:bg-blue-500 selection:text-white">
      {/* Toast Notification with Blur & Slide Animation */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-w-sm bg-slate-900/90 border border-white/20 text-white backdrop-blur-xl shadow-slate-900/20 ${
            toast.isClosing ? 'animate-toastOut' : 'animate-toastIn'
          }`}
        >
          <div className="px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center space-x-2.5 text-xs font-medium">
              <div className="p-1 rounded-full bg-emerald-500/20 text-emerald-400">
                <Check className="w-3.5 h-3.5" />
              </div>
              <span className="text-slate-100">{toast.message}</span>
            </div>
            <button
              onClick={closeToast}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
              title="Close notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {/* Progress bar */}
          <div className="h-0.5 bg-gradient-to-r from-blue-400 to-indigo-500 w-full animate-toastProgress" />
        </div>
      )}

      {/* Top Header Navigation */}
      <header
        className={`sticky top-0 z-40 px-6 sm:px-10 py-4 transition-all duration-300 ${
          hasScrolled
            ? 'bg-white/75 backdrop-blur-xl border-b border-slate-200/80 shadow-[0_4px_20px_rgba(15,23,42,0.04)]'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Brand Logo */}
          <div className="flex items-center space-x-2.5 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="flex items-center space-x-1.5">
              <span className="text-xl font-bold tracking-tight text-slate-900 flex items-center">
                Ver<span className="inline-block w-1.5 h-1.5 bg-rose-500 rounded-sm mx-0.5 mb-2.5" />tas
              </span>
            </div>
          </div>

          {/* Center Navigation Links */}
          <nav className="hidden md:flex items-center space-x-7 text-xs font-medium text-slate-600">
            <button onClick={scrollToUpload} className="hover:text-slate-900 transition">
              Features
            </button>
            <button onClick={openInfoModal} className="hover:text-slate-900 transition">
              OCR Engine
            </button>
            <button onClick={scrollToUpload} className="hover:text-slate-900 transition">
              Citations
            </button>
            <button onClick={scrollToUpload} className="hover:text-slate-900 transition">
              Integrations
            </button>
          </nav>

          {/* Action Button */}
          <div className="flex items-center space-x-3">
            <button
              onClick={openInfoModal}
              className="p-2 text-slate-500 hover:text-slate-800 rounded-xl transition hover:bg-slate-100/80"
              title="How Veritas Works"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
            <button
              onClick={scrollToUpload}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-all duration-200 shadow-sm hover:shadow active:scale-95 flex items-center gap-1.5"
            >
              <span>Check Document</span>
            </button>
          </div>
        </div>
      </header>

      {/* SECTION 1: HERO LANDING SECTION */}
      <section className="relative px-6 pt-10 pb-16 sm:pt-16 sm:pb-24 max-w-6xl mx-auto w-full flex flex-col items-center justify-center text-center">
        {/* Floating pill tags on the sides */}
        <div className="hidden lg:block absolute top-14 right-8 frost-pill px-3 py-1.5 rounded-full text-[11px] text-slate-600 font-medium animate-floatSlow shadow-sm">
          Slides & sheets
        </div>
        <div className="hidden lg:block absolute top-40 right-2 frost-pill px-3.5 py-1.5 rounded-full text-[11px] text-slate-600 font-medium animate-floatReverse shadow-sm">
          Images & videos
        </div>
        <div className="hidden lg:block absolute bottom-32 right-12 frost-pill px-3 py-1.5 rounded-full text-[11px] text-slate-600 font-medium animate-floatSlow shadow-sm">
          Text & links
        </div>

        <div className="hidden lg:block absolute top-28 left-4 frost-pill px-3 py-1.5 rounded-full text-[11px] text-slate-600 font-medium animate-floatReverse shadow-sm">
          Documents
        </div>
        <div className="hidden lg:block absolute bottom-36 left-8 frost-pill px-3.5 py-1.5 rounded-full text-[11px] text-slate-600 font-medium animate-floatSlow shadow-sm">
          Charts & Graphs
        </div>
        <div className="hidden lg:block absolute top-12 left-16 frost-pill px-3.5 py-1.5 rounded-full text-[11px] text-slate-600 font-medium animate-floatSlow shadow-sm">
          Multi-modal OCR
        </div>

        {/* Hero Headline */}
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-900 leading-[1.08]">
            Find Any Plagiarized Phrasing<span className="inline-block w-2.5 h-2.5 bg-rose-500 rounded-sm mx-1 mb-1.5 sm:mb-2" /> In Seconds<span className="inline-block w-2.5 h-2.5 bg-rose-500 rounded-sm mx-1 mb-1.5 sm:mb-2" />
          </h1>
          <p className="text-sm sm:text-base text-slate-500 max-w-2xl mx-auto mt-4 sm:mt-5 leading-relaxed font-normal">
            Upload PDFs, Word docs, scanned notes, and charts in one place. Veritas reads them with Multimodal OCR, cross-references academic indices, and uncovers originality instantly.
          </p>
        </div>

        {/* Center CTA Button */}
        <div className="mt-8 flex flex-col items-center justify-center">
          <button
            onClick={scrollToUpload}
            className="group relative inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl bg-[#1e2029] hover:bg-[#12141c] text-white font-semibold text-sm shadow-[0_14px_30px_rgba(15,23,42,0.22)] transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            <span>Get Started Free</span>
            <span className="text-rose-400 font-bold text-xs tracking-widest group-hover:translate-x-1 transition-transform">
              &raquo;
            </span>
          </button>
          <span className="text-[11px] text-slate-400 mt-2.5 font-medium">
            Add anything &bull; Instant In-Browser Evaluation (Up to 500MB)
          </span>
        </div>

        {/* Interactive Quick Bar */}
        <div
          onClick={scrollToUpload}
          className="mt-7 w-full max-w-xl mx-auto frost-pill rounded-full p-2 pl-5 pr-3 flex items-center justify-between gap-3 cursor-pointer hover:border-blue-300 transition group shadow-md"
        >
          <div className="flex items-center space-x-2 text-xs text-slate-400 group-hover:text-slate-600 transition truncate">
            <span className="text-slate-400 text-sm font-semibold">+</span>
            <span className="truncate">Find or drop what you want to check (PDF, Word, OCR up to 500MB)...</span>
          </div>
          <div className="flex items-center space-x-2 flex-shrink-0">
            <div className="p-1.5 rounded-full bg-blue-50 text-blue-600">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div className="w-3.5 h-3.5 bg-rose-500 rounded-sm transform rotate-45" />
          </div>
        </div>

        {/* Logos & Trust Badges */}
        <div className="mt-14 pt-8 border-t border-slate-200/60 w-full max-w-4xl flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-slate-400 text-xs font-semibold grayscale opacity-75">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-slate-500" /> Turnitin Compatible
          </span>
          <span className="flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-slate-500" /> ArXiv Preprints
          </span>
          <span className="flex items-center gap-1.5">
            <Cpu className="w-4 h-4 text-slate-500" /> Tesseract OCR
          </span>
          <span className="flex items-center gap-1.5">
            <FileSearch className="w-4 h-4 text-slate-500" /> Crossref Index
          </span>
          <span className="flex items-center gap-1.5">
            <GraduationCap className="w-4 h-4 text-slate-500" /> IEEE / MLA Standards
          </span>
        </div>

        {/* Bounce Scroll Guide */}
        <div
          onClick={scrollToUpload}
          className="mt-6 flex flex-col items-center text-slate-400 hover:text-blue-600 transition cursor-pointer group"
        >
          <span className="text-[10px] font-semibold uppercase tracking-wider mb-1">
            Scroll down to check
          </span>
          <ArrowDown className="w-4 h-4 animate-bounceSlow group-hover:text-blue-600" />
        </div>
      </section>

      {/* SECTION 2: WORKSPACE & UPLOAD */}
      <section
        ref={uploadSectionRef}
        id="workspace-section"
        className="scroll-mt-24 max-w-4xl w-full mx-auto px-4 sm:px-6 pb-20 transition-all duration-500"
      >
        {/* Toggle Workspace Bar if collapsed */}
        {!isUploadOpen && (
          <div className="text-center py-6">
            <button
              onClick={() => setIsUploadOpen(true)}
              className="px-6 py-3 rounded-2xl bg-white border border-slate-200 text-slate-700 font-semibold text-xs shadow-md hover:bg-slate-50 transition flex items-center gap-2 mx-auto"
            >
              <FileText className="w-4 h-4 text-blue-600" />
              <span>Open Document Upload & Checker Workspace</span>
            </button>
          </div>
        )}

        {/* WORKSPACE CONTENT WITH BLUR REVEAL ANIMATION */}
        {isUploadOpen && (
          <div className="w-full space-y-6 animate-blurFadeIn">
            {/* Mode Switcher Tabs */}
            <div className="flex justify-center">
              <div className="inline-flex p-1 rounded-2xl frost-card border border-white/80 text-xs shadow-sm">
                <button
                  onClick={() => setActiveTab('scan')}
                  className={`px-4 py-2 rounded-xl font-semibold transition flex items-center gap-1.5 ${
                    activeTab === 'scan'
                      ? 'bg-slate-900 text-white shadow-md'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Single Document</span>
                </button>
                <button
                  onClick={() => setActiveTab('compare')}
                  className={`px-4 py-2 rounded-xl font-semibold transition flex items-center gap-1.5 ${
                    activeTab === 'compare'
                      ? 'bg-slate-900 text-white shadow-md'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>Compare Two Texts</span>
                </button>
              </div>
            </div>

            {activeTab === 'scan' ? (
              /* SCAN MODE */
              <div className="space-y-6">
                {/* Upload Files Card */}
                <div className="dark-upload-card rounded-3xl p-6 sm:p-7 shadow-2xl">
                  <h2 className="text-center font-bold text-base text-slate-100 tracking-wide mb-4">
                    Upload Files
                  </h2>

                  {/* Inner Dropzone */}
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`bg-[#1f222e] border border-dashed rounded-2xl p-7 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center space-y-1.5 ${
                      isDragging
                        ? 'border-blue-400 bg-blue-950/40 scale-[1.01]'
                        : 'border-slate-700 hover:border-blue-400 hover:bg-[#252836]'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".doc,.docx,.odt,.rtf,.txt,.md,.html,.htm,.pdf,image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <p className="text-sm font-semibold text-slate-100">
                      Drop file here or browse
                    </p>
                    <p className="text-xs text-slate-400">
                      PDF, WORD up to 500MB
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Supported: .doc, .docx, .odt, .rtf, .txt, .html, .pdf (Includes images & charts OCR)
                    </p>
                  </div>

                  {/* Reading Progress Indicator */}
                  {isReadingFile && (
                    <div className="mt-4 p-3.5 bg-[#1d202b] border border-blue-500/40 rounded-2xl animate-fadeIn">
                      <div className="flex items-center justify-between text-xs text-blue-200 mb-1.5">
                        <span className="font-medium flex items-center gap-2">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
                          {readFileProgress.stage || 'Reading full document & charts...'}
                        </span>
                        <span className="font-semibold text-blue-300 font-mono">
                          {readFileProgress.percent}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-blue-500 h-full rounded-full transition-all duration-300 animate-shimmer"
                          style={{ width: `${readFileProgress.percent}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Uploaded File List */}
                  {uploadedFiles.length > 0 && (
                    <div className="mt-4 space-y-2.5">
                      {uploadedFiles.map((fileItem) => {
                        const isRemoving = removingFileId === fileItem.id;
                        return (
                          <div
                            key={fileItem.id}
                            className={`bg-[#1d202b] border border-slate-700/80 hover:border-slate-600 rounded-2xl p-3.5 flex items-center justify-between transition-all ${
                              isRemoving ? 'animate-fileRemove' : 'animate-fileAdd'
                            }`}
                          >
                            <div className="flex items-center space-x-3.5 min-w-0">
                              <div
                                className={`w-10 h-10 rounded-xl ${fileItem.badgeBg} flex items-center justify-center text-[10px] font-black text-white uppercase tracking-wider shadow-md flex-shrink-0`}
                              >
                                {fileItem.badge}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-100 truncate max-w-[220px] sm:max-w-md">
                                  {fileItem.name}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[11px] text-slate-400 font-mono">
                                    {fileItem.sizeFormatted}
                                  </span>
                                  {fileItem.status === 'reading' ? (
                                    <span className="text-[10px] text-blue-400 flex items-center gap-1 font-medium">
                                      <RefreshCw className="w-3 h-3 animate-spin" /> Reading...
                                    </span>
                                  ) : fileItem.status === 'ready' ? (
                                    <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
                                      <CheckCircle2 className="w-3 h-3" /> Read complete ({fileItem.wordCount || 0} words)
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-rose-400 flex items-center gap-1 font-medium">
                                      <XCircle className="w-3 h-3" /> Read failed
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeFile(fileItem.id);
                              }}
                              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition cursor-pointer"
                              title="Remove file"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Action Button */}
                  <button
                    disabled={isAnalyzing || isReadingFile}
                    onClick={runPlagiarismScan}
                    className="w-full mt-5 bg-white hover:bg-slate-100 active:scale-[0.99] text-slate-950 font-bold py-3.5 px-6 rounded-2xl text-sm transition-all shadow-lg flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
                  >
                    {isAnalyzing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-slate-900" />
                        <span>Scanning for similarities & citations...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-blue-600" />
                        <span>Upload & Check Plagiarism</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Extracted Document Text & Manual Editor Card */}
                <div className="frost-card rounded-3xl p-5 sm:p-7 shadow-xl">
                  <div className="flex items-center justify-between pb-3.5 border-b border-slate-200/60 mb-4">
                    <div className="flex items-center space-x-2">
                      <AlignLeft className="w-4 h-4 text-blue-600" />
                      <h3 className="font-semibold text-sm text-slate-900">
                        Extracted Document Content & Text Editor
                      </h3>
                    </div>
                    {(inputText || uploadedFiles.length > 0) && (
                      <button
                        onClick={openClearConfirm}
                        className="text-xs text-slate-400 hover:text-rose-600 transition font-medium flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Clear All</span>
                      </button>
                    )}
                  </div>

                  <div className="relative flex flex-col min-h-[200px]">
                    <textarea
                      rows={8}
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder="Extracted text from your uploaded document(s), PDFs, images, and charts will appear here. You can also paste or edit your text directly..."
                      className="w-full bg-white/90 border border-slate-200 rounded-2xl p-4 text-sm leading-relaxed resize-y shadow-inner font-sans text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                    />
                    <div className="flex justify-between items-center text-[11px] mt-2 px-1 font-medium text-slate-500">
                      <span className="flex items-center gap-1.5">
                        Words: <strong className="text-slate-800">{wordCount}</strong>
                        <span>&bull;</span>
                        <span>~{readingTime} min read</span>
                      </span>
                      <span>{inputText.length} characters</span>
                    </div>
                  </div>

                  {errorMsg && (
                    <div className="mt-3.5 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center space-x-2 animate-fadeIn">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-500" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  {isAnalyzing && (
                    <div className="mt-4 p-3.5 bg-blue-50 border border-blue-100 rounded-2xl animate-fadeIn">
                      <div className="flex items-center justify-between text-xs text-blue-900 mb-1.5">
                        <span className="font-medium flex items-center gap-2">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                          {scanProgress.stage || 'Checking writing for originality...'}
                        </span>
                        <span className="font-semibold text-blue-700 font-mono">
                          {scanProgress.percent}%
                        </span>
                      </div>
                      <div className="w-full bg-blue-200/60 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-blue-600 h-full rounded-full transition-all duration-300 animate-shimmer"
                          style={{ width: `${scanProgress.percent}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Scan History with Accordion */}
                {!analysisResult && history.length > 0 && (
                  <div className="frost-card rounded-3xl p-5 shadow-xl animate-fadeIn">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-2">
                      <button
                        onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
                        className="flex items-center space-x-1.5 text-slate-700 hover:text-blue-600 transition font-bold"
                      >
                        <Clock className="w-3.5 h-3.5 text-blue-500" />
                        <span>Recent Scans ({history.length})</span>
                        {isHistoryExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                        )}
                      </button>
                      <button
                        onClick={clearHistory}
                        className="text-[11px] text-slate-400 hover:text-rose-600 transition"
                      >
                        Clear All History
                      </button>
                    </div>

                    <div className={`accordion-content ${isHistoryExpanded ? 'expanded' : ''}`}>
                      <div className="accordion-inner pt-2 space-y-2">
                        {history.map((item) => {
                          const isRemoving = removingHistoryId === item.id;
                          return (
                            <div
                              key={item.id}
                              onClick={() => loadFromHistory(item)}
                              className={`flex items-center justify-between text-xs p-3 rounded-xl border bg-white/70 hover:bg-blue-50/80 border-slate-200/80 hover:border-blue-300 text-slate-800 cursor-pointer transition ${
                                isRemoving ? 'animate-fileRemove' : 'animate-fadeIn'
                              }`}
                            >
                              <div className="truncate max-w-md">
                                <p className="font-medium truncate text-slate-800">{item.snippet}</p>
                                <span className="text-[10px] text-slate-400">{item.date}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {item.fullResult?.aiGeneratedLikelihood > 35 && (
                                  <span className="font-semibold text-[11px] px-2 py-0.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                                    <Sparkles className="w-3 h-3 text-purple-500" />
                                    {item.fullResult.aiGeneratedLikelihood}% AI
                                  </span>
                                )}
                                <span
                                  className={`font-semibold text-xs px-2.5 py-1 rounded-lg ${
                                    item.score >= 80
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : item.score >= 50
                                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                                  }`}
                                >
                                  {item.score}% Original
                                </span>
                                <button
                                  onClick={(e) => removeHistoryItem(e, item.id)}
                                  className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-slate-200/60 transition"
                                  title="Delete from history"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Originality Report & Cascade Entrance */}
                {analysisResult && (
                  <div className="space-y-5">
                    {/* Score Overview Card */}
                    <div className="frost-card rounded-3xl p-6 sm:p-7 shadow-xl animate-blurFadeIn stagger-1">
                      <div className="flex flex-wrap items-center justify-between pb-4 border-b border-slate-100 gap-4">
                        <div>
                          <div className="flex items-center space-x-2.5">
                            <h3 className="text-lg font-bold text-slate-900">
                              Originality & Integrity Report
                            </h3>
                            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                              {analysisResult.wordCount} words
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            Status:{' '}
                            <strong
                              className={
                                analysisResult.originalityScore >= 80
                                  ? 'text-emerald-600'
                                  : analysisResult.originalityScore >= 50
                                  ? 'text-amber-600'
                                  : 'text-rose-600'
                              }
                            >
                              {analysisResult.overallVerdict}
                            </strong>
                          </p>
                        </div>

                        <div className="flex items-center space-x-4">
                          <button
                            onClick={() => exportReportToPdf(analysisResult, fileName || 'Originality-Report')}
                            className="px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-sm border bg-white hover:bg-slate-50 text-slate-700 border-slate-300"
                          >
                            <Download className="w-4 h-4 text-blue-600" />
                            <span>Download PDF</span>
                          </button>

                          <div className="text-right">
                            <span
                              className={`text-3xl font-extrabold font-mono leading-none inline-block animate-scorePop ${
                                analysisResult.originalityScore >= 80
                                  ? 'text-emerald-600'
                                  : analysisResult.originalityScore >= 50
                                  ? 'text-amber-600'
                                  : 'text-rose-600'
                              }`}
                            >
                              {analysisResult.originalityScore}%
                            </span>
                            <span className="block text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
                              Originality
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Metrics Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                        <div className="p-3.5 rounded-2xl border border-slate-200/80 bg-white/80 hover:bg-white text-center transition shadow-sm">
                          <span className="text-xs font-medium text-slate-500">
                            Direct Matches
                          </span>
                          <p className="text-xl font-bold font-mono text-rose-600 mt-0.5">
                            {analysisResult.exactMatchPercentage || 0}%
                          </p>
                        </div>
                        <div className="p-3.5 rounded-2xl border border-slate-200/80 bg-white/80 hover:bg-white text-center transition shadow-sm">
                          <span className="text-xs font-medium text-slate-500">
                            Paraphrased
                          </span>
                          <p className="text-xl font-bold font-mono text-amber-600 mt-0.5">
                            {analysisResult.paraphrasedPercentage}%
                          </p>
                        </div>
                        <div className="p-3.5 rounded-2xl border border-purple-200/80 bg-purple-50/40 hover:bg-purple-50/70 text-center transition shadow-sm">
                          <span className="text-xs font-semibold text-purple-800 flex items-center justify-center gap-1">
                            <Sparkles className="w-3.5 h-3.5 text-purple-600" /> AI Likelihood
                          </span>
                          <p className="text-xl font-bold font-mono text-purple-700 mt-0.5">
                            {analysisResult.aiGeneratedLikelihood}%
                          </p>
                          <span className="text-[10px] font-medium text-purple-600/90 block -mt-0.5">
                            {analysisResult.aiSentenceCount || 0} sentence{analysisResult.aiSentenceCount === 1 ? '' : 's'} flagged
                          </span>
                        </div>
                        <div className="p-3.5 rounded-2xl border border-slate-200/80 bg-white/80 hover:bg-white text-center transition shadow-sm">
                          <span className="text-xs font-medium text-slate-500">
                            Reading Level
                          </span>
                          <p className="text-sm font-bold text-slate-800 mt-1 truncate">
                            {analysisResult.readability?.gradeLevel || 'Standard'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Sentence Reader */}
                    <div className="frost-card rounded-3xl p-6 shadow-xl animate-blurFadeIn stagger-2">
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          Sentence Breakdown & Diagnostics
                        </h4>

                        <div className="flex flex-wrap p-1 rounded-xl text-xs border bg-slate-100 border-slate-200 gap-1">
                          <button
                            onClick={() => setSentenceFilter('all')}
                            className={`px-3 py-1 rounded-lg font-medium transition ${
                              sentenceFilter === 'all'
                                ? 'bg-white text-slate-900 shadow-sm font-semibold'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            All ({analysisResult.sentenceAnalysis?.length || 0})
                          </button>
                          <button
                            onClick={() => setSentenceFilter('AI-Generated')}
                            className={`px-3 py-1 rounded-lg font-medium transition flex items-center gap-1.5 ${
                              sentenceFilter === 'AI-Generated'
                                ? 'bg-purple-100 text-purple-900 font-semibold shadow-sm'
                                : 'text-slate-500 hover:text-purple-800'
                            }`}
                          >
                            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                            AI-Generated (
                            {
                              analysisResult.sentenceAnalysis?.filter((s) => s.status === 'AI-Generated')
                                .length || 0
                            }
                            )
                          </button>
                          <button
                            onClick={() => setSentenceFilter('Plagiarized')}
                            className={`px-3 py-1 rounded-lg font-medium transition ${
                              sentenceFilter === 'Plagiarized'
                                ? 'bg-rose-100 text-rose-800 font-semibold shadow-sm'
                                : 'text-slate-500 hover:text-rose-700'
                            }`}
                          >
                            Matches (
                            {
                              analysisResult.sentenceAnalysis?.filter((s) => s.status === 'Plagiarized')
                                .length || 0
                            }
                            )
                          </button>
                          <button
                            onClick={() => setSentenceFilter('Paraphrased')}
                            className={`px-3 py-1 rounded-lg font-medium transition ${
                              sentenceFilter === 'Paraphrased'
                                ? 'bg-amber-100 text-amber-800 font-semibold shadow-sm'
                                : 'text-slate-500 hover:text-amber-700'
                            }`}
                          >
                            Paraphrased (
                            {
                              analysisResult.sentenceAnalysis?.filter((s) => s.status === 'Paraphrased')
                                .length || 0
                            }
                            )
                          </button>
                          <button
                            onClick={() => setSentenceFilter('Original')}
                            className={`px-3 py-1 rounded-lg font-medium transition ${
                              sentenceFilter === 'Original'
                                ? 'bg-emerald-100 text-emerald-800 font-semibold shadow-sm'
                                : 'text-slate-500 hover:text-emerald-700'
                            }`}
                          >
                            Original (
                            {
                              analysisResult.sentenceAnalysis?.filter((s) => s.status === 'Original')
                                .length || 0
                            }
                            )
                          </button>
                        </div>
                      </div>

                      <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 text-slate-800 text-sm leading-relaxed max-h-60 overflow-y-auto font-sans">
                        {getFilteredSentences().map((item, idx) => {
                          const isSelected = selectedSentence === idx;
                          let highlightClass =
                            'cursor-pointer transition px-1.5 py-0.5 rounded-md inline my-0.5 text-xs ';
                          if (item.status === 'Plagiarized') {
                            highlightClass += 'bg-rose-100 text-rose-900 border-b-2 border-rose-400 hover:bg-rose-200 ';
                          } else if (item.status === 'Paraphrased') {
                            highlightClass += 'bg-amber-100 text-amber-900 border-b-2 border-amber-400 hover:bg-amber-200 ';
                          } else if (item.status === 'AI-Generated') {
                            highlightClass += 'bg-purple-100 text-purple-950 border-b-2 border-purple-400 hover:bg-purple-200 ';
                          } else {
                            highlightClass += 'text-slate-700 hover:bg-emerald-50 ';
                          }

                          if (isSelected) {
                            highlightClass += 'ring-2 ring-blue-500 font-semibold ';
                          }

                          return (
                            <span
                              key={idx}
                              onClick={() => handleSelectSentence(idx)}
                              className={highlightClass}
                              title="Click to review sentence insights"
                            >
                              {item.sentence}{' '}
                            </span>
                          );
                        })}
                      </div>

                      {/* Selected Sentence Inspector Box */}
                      {selectedSentence !== null &&
                        getFilteredSentences()[selectedSentence] && (
                          <div
                            className={`mt-4 p-4 rounded-2xl border border-slate-200 bg-white shadow-md ${
                              isClosingSentence ? 'animate-inspectorClose' : 'animate-inspectorOpen'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-1.5">
                                <Eye className="w-4 h-4 text-blue-600" />
                                <span className="text-xs font-bold text-slate-900">
                                  Sentence Review
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                {getStatusBadge(
                                  getFilteredSentences()[selectedSentence].status
                                )}
                                <button
                                  onClick={handleCloseSentence}
                                  className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                                  title="Close review box"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                            <p className="text-xs mb-2 italic p-2.5 rounded-xl border border-slate-100 bg-slate-50 text-slate-700">
                              "{getFilteredSentences()[selectedSentence].sentence}"
                            </p>
                            <div className="text-xs space-y-1.5 text-slate-600">
                              <p>
                                <strong className="text-slate-800">Observation:</strong>{' '}
                                {getFilteredSentences()[selectedSentence].reason}
                              </p>
                              {getFilteredSentences()[selectedSentence].suggestedFix && (
                                <div className="mt-2 p-3 rounded-xl border border-emerald-200 bg-emerald-50/50 text-emerald-900 flex items-start justify-between gap-2.5">
                                  <p className="text-xs leading-relaxed">
                                    <strong>Suggested Action:</strong>{' '}
                                    {getFilteredSentences()[selectedSentence].suggestedFix}
                                  </p>
                                  <button
                                    onClick={() =>
                                      copyToClipboard(
                                        getFilteredSentences()[selectedSentence].suggestedFix,
                                        'suggestion'
                                      )
                                    }
                                    className="p-1 rounded text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100 transition flex-shrink-0"
                                    title="Copy suggestion"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                    </div>

                    {/* Matched Sources */}
                    {analysisResult.potentialSources?.length > 0 && (
                      <div className="frost-card rounded-3xl p-6 shadow-xl animate-blurFadeIn stagger-3">
                        <div className="flex items-center space-x-2 mb-3.5">
                          <BookOpen className="w-4 h-4 text-blue-600" />
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                            Matched Sources & Citations
                          </h4>
                        </div>
                        <div className="space-y-3">
                          {analysisResult.potentialSources.map((source, sIdx) => (
                            <div
                              key={sIdx}
                              className="p-3.5 rounded-2xl border border-slate-200/80 bg-white/70 hover:bg-white flex flex-col space-y-2 transition shadow-sm"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-1.5">
                                  <span className="text-xs font-semibold text-slate-800">
                                    {source.title}
                                  </span>
                                  {source.url && (
                                    <a
                                      href={source.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-blue-600 hover:text-blue-800"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded border text-rose-700 bg-rose-50 border-rose-100">
                                    ~{source.similarity}% match
                                  </span>
                                  <button
                                    onClick={() => openSourceModal(source)}
                                    className="text-xs text-blue-600 hover:text-blue-800 font-medium underline-offset-2 hover:underline ml-1"
                                  >
                                    Inspect
                                  </button>
                                </div>
                              </div>
                              <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-600">
                                <p className="text-[11px] font-mono truncate">
                                  {source.citation}
                                </p>
                                <button
                                  onClick={() => copyToClipboard(source.citation, 'citation')}
                                  className="p-1 flex-shrink-0 text-slate-400 hover:text-slate-700 transition"
                                  title="Copy Citation"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Writing Recommendations */}
                    {analysisResult.recommendations?.length > 0 && (
                      <div className="frost-card rounded-3xl p-6 shadow-xl animate-blurFadeIn stagger-4">
                        <div className="flex items-center space-x-2 mb-3">
                          <Sparkles className="w-4 h-4 text-amber-500" />
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                            Writing Suggestions & Next Steps
                          </h4>
                        </div>
                        <ul className="space-y-2 text-xs text-slate-600">
                          {analysisResult.recommendations.map((rec, rIdx) => (
                            <li key={rIdx} className="flex items-start space-x-2.5">
                              <span className="text-blue-600 font-bold">&bull;</span>
                              <span className="leading-relaxed">{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* COMPARE MODE */
              <div className="space-y-5 animate-blurFadeIn">
                <div className="frost-card rounded-3xl p-5 sm:p-6 shadow-xl">
                  <div className="flex flex-wrap items-center justify-between pb-4 border-b border-slate-200/60 mb-4 gap-3">
                    <div>
                      <h2 className="font-bold text-base text-slate-900 flex items-center gap-2">
                        <ArrowRightLeft className="w-4 h-4 text-blue-600" />
                        Side-by-Side Text Comparison
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Compare two pieces of text directly to inspect duplicate phrasing and vocabulary overlap.
                      </p>
                    </div>
                    <button
                      onClick={runComparison}
                      className="py-2.5 px-4 rounded-xl font-bold text-xs bg-slate-900 hover:bg-slate-800 text-white shadow-md flex items-center gap-1.5 transition active:scale-[0.98]"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>Compare Texts</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col">
                      <label className="text-xs font-semibold text-slate-700 mb-1.5">
                        Original Reference (Document A)
                      </label>
                      <textarea
                        rows={9}
                        value={compareTextA}
                        onChange={(e) => setCompareTextA(e.target.value)}
                        placeholder="Paste reference text or original source document here..."
                        className="w-full rounded-2xl p-3 text-xs leading-relaxed font-sans resize-none bg-white border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder-slate-400"
                      />
                    </div>

                    <div className="flex flex-col">
                      <label className="text-xs font-semibold text-slate-700 mb-1.5">
                        Candidate Text (Document B)
                      </label>
                      <textarea
                        rows={9}
                        value={compareTextB}
                        onChange={(e) => setCompareTextB(e.target.value)}
                        placeholder="Paste candidate text or submission here..."
                        className="w-full rounded-2xl p-3 text-xs leading-relaxed font-sans resize-none bg-white border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder-slate-400"
                      />
                    </div>
                  </div>
                </div>

                {/* Comparison Results */}
                {compareResult && (
                  <div className="frost-card rounded-3xl p-5 sm:p-6 shadow-xl animate-modalIn">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200/60">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          Comparison Result
                        </h3>
                        <p className="text-xs">
                          {compareResult.similarityScore > 50 ? (
                            <span className="text-rose-600 font-semibold">Significant Overlap Detected</span>
                          ) : (
                            <span className="text-emerald-600 font-semibold">Low / Acceptable Overlap</span>
                          )}
                        </p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`text-2xl font-extrabold font-mono inline-block animate-scorePop ${
                            compareResult.similarityScore > 50 ? 'text-rose-600' : 'text-emerald-600'
                          }`}
                        >
                          {compareResult.similarityScore}%
                        </span>
                        <span className="block text-[10px] text-slate-400 font-semibold uppercase">
                          Similarity
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                      <div className="p-3 rounded-2xl border border-slate-200 bg-white/80 text-slate-800 text-center">
                        <span className="text-[11px] text-slate-500">Matching Phrases</span>
                        <p className="text-base font-bold font-mono mt-0.5">
                          {compareResult.exactMatchingPhrases}
                        </p>
                      </div>
                      <div className="p-3 rounded-2xl border border-slate-200 bg-white/80 text-slate-800 text-center">
                        <span className="text-[11px] text-slate-500">Vocabulary Similarity</span>
                        <p className="text-base font-bold font-mono mt-0.5">
                          {compareResult.jaccardPercentage}%
                        </p>
                      </div>
                      <div className="p-3 rounded-2xl border border-slate-200 bg-white/80 text-slate-800 text-center">
                        <span className="text-[11px] text-slate-500">Sequence Alignment</span>
                        <p className="text-base font-bold font-mono mt-0.5">
                          {compareResult.lcsPercentage}%
                        </p>
                      </div>
                      <div className="p-3 rounded-2xl border border-slate-200 bg-white/80 text-slate-800 text-center">
                        <span className="text-[11px] text-slate-500">Word Count (A / B)</span>
                        <p className="text-base font-bold font-mono mt-0.5">
                          {compareResult.wordsA} / {compareResult.wordsB}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* MODAL 1: Source Citation Inspector */}
      {inspectSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
          <div
            className={`fixed inset-0 ${
              isClosingSourceModal ? 'animate-backdropOut' : 'animate-backdropIn'
            }`}
            onClick={closeSourceModal}
          />
          <div
            className={`relative z-10 w-full max-w-lg rounded-3xl shadow-2xl border border-white/90 bg-white/95 text-slate-800 backdrop-blur-2xl p-6 ${
              isClosingSourceModal ? 'animate-modalOut' : 'animate-modalIn'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <BookOpen className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-base text-slate-900">
                  Source Citation Inspector
                </h3>
              </div>
              <button
                onClick={closeSourceModal}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div>
                <span className="font-semibold block mb-1 text-slate-700">
                  Source Title / Reference:
                </span>
                <p className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-medium">
                  {inspectSource.title}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                  <span className="block text-[10px] uppercase font-bold text-slate-500">
                    Match Score
                  </span>
                  <span className="text-rose-600 font-mono font-bold text-sm">~{inspectSource.similarity}% match</span>
                </div>
                <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                  <span className="block text-[10px] uppercase font-bold text-slate-500">
                    Format
                  </span>
                  <span className="font-medium text-xs text-slate-700">
                    APA / MLA Academic Format
                  </span>
                </div>
              </div>

              <div>
                <span className="font-semibold block mb-1 text-slate-700">
                  Standard Academic Citation:
                </span>
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-mono text-[11px] flex items-center justify-between gap-2">
                  <span className="break-all">{inspectSource.citation}</span>
                  <button
                    onClick={() => copyToClipboard(inspectSource.citation, 'citation')}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-blue-600 transition flex-shrink-0"
                    title="Copy citation"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {inspectSource.url && (
                <div>
                  <a
                    href={inspectSource.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 font-medium underline"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open Reference Link</span>
                  </a>
                </div>
              )}
            </div>

            <div className="mt-6 pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={closeSourceModal}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition shadow-md"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Guide & OCR Information */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
          <div
            className={`fixed inset-0 ${
              isClosingInfoModal ? 'animate-backdropOut' : 'animate-backdropIn'
            }`}
            onClick={closeInfoModal}
          />
          <div
            className={`relative z-10 w-full max-w-xl rounded-3xl shadow-2xl border border-white/90 bg-white/95 text-slate-800 backdrop-blur-2xl p-6 ${
              isClosingInfoModal ? 'animate-modalOut' : 'animate-modalIn'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-base text-slate-900">
                  How Veritas Originality Engine Works
                </h3>
              </div>
              <button
                onClick={closeInfoModal}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-xs max-h-96 overflow-y-auto pr-1">
              <div className="p-3 rounded-2xl border border-blue-100 bg-blue-50/50">
                <h4 className="font-bold mb-1 flex items-center gap-1.5 text-blue-900">
                  <CheckCheck className="w-3.5 h-3.5 text-blue-600" />
                  1. Multi-Dimensional Similarity Engine
                </h4>
                <p className="leading-relaxed text-slate-600">
                  Veritas evaluates text across multiple algorithms: 5-gram exact overlap, Jaccard vocabulary index, Longest Common Subsequence (LCS) alignment, and semantic sentence variation metrics.
                </p>
              </div>

              <div className="p-3 rounded-2xl border border-slate-200 bg-slate-50">
                <h4 className="font-bold mb-1 flex items-center gap-1.5 text-slate-900">
                  <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                  2. Multimodal OCR & Image Parsing
                </h4>
                <p className="leading-relaxed text-slate-600">
                  Documents with charts, diagrams, scanned PDFs, or handwritten notes are parsed through Tesseract OCR to extract visual text alongside standard typography.
                </p>
              </div>

              <div className="p-3 rounded-2xl border border-slate-200 bg-slate-50">
                <h4 className="font-bold mb-1 flex items-center gap-1.5 text-slate-900">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  3. Citation & Paraphrase Diagnostics
                </h4>
                <p className="leading-relaxed text-slate-600">
                  Sentences flagged as paraphrased or matched receive actionable recommendations and academic citations (APA/MLA) so writers can cite sources appropriately.
                </p>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={closeInfoModal}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition shadow-md"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Clear All Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
          <div
            className={`fixed inset-0 ${
              isClosingClearConfirm ? 'animate-backdropOut' : 'animate-backdropIn'
            }`}
            onClick={closeClearConfirm}
          />
          <div
            className={`relative z-10 w-full max-w-sm rounded-3xl shadow-2xl border border-white/90 bg-white/95 text-slate-800 backdrop-blur-2xl p-5 ${
              isClosingClearConfirm ? 'animate-modalOut' : 'animate-modalIn'
            }`}
          >
            <div className="flex items-center space-x-2.5 mb-2">
              <div className="p-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
                <Trash2 className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-sm text-slate-900">
                Clear Workspace?
              </h3>
            </div>
            <p className="text-xs leading-relaxed mb-4 text-slate-600">
              This will remove all uploaded files, current text, and generated reports.
            </p>
            <div className="flex items-center justify-end space-x-2">
              <button
                onClick={closeClearConfirm}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmClear}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 transition shadow-sm"
              >
                Clear Everything
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RICH MODERN FOOTER WITH SOCIAL SECTION */}
      <footer className="mt-auto bg-[#0d111d] text-slate-300 pt-16 pb-12 px-6 sm:px-12 border-t border-slate-800/80 rounded-t-[2.5rem] shadow-2xl">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-slate-800/80">
          {/* Brand & Overview Column */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center space-x-2">
              <span className="text-2xl font-bold tracking-tight text-white flex items-center">
                Ver<span className="inline-block w-2 h-2 bg-rose-500 rounded-sm mx-0.5 mb-3" />tas
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                v2.4 Originality
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
              AI-Powered Originality & Plagiarism Detection with Multimodal OCR & Image Support. Built for academic integrity, citation accuracy, and professional publishing.
            </p>
            <div className="flex items-center space-x-2 text-[11px] text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>All validation engines operational &bull; In-Browser Privacy</span>
            </div>
          </div>

          {/* Product & Features Column */}
          <div>
            <h4 className="text-sm font-bold text-white mb-4 tracking-wide">
              Product
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-400">
              <li>
                <button onClick={scrollToUpload} className="hover:text-white transition">
                  Document Scanner
                </button>
              </li>
              <li>
                <button onClick={() => { setActiveTab('compare'); scrollToUpload(); }} className="hover:text-white transition">
                  Side-by-Side Comparison
                </button>
              </li>
              <li>
                <button onClick={openInfoModal} className="hover:text-white transition">
                  Multimodal OCR Parsing
                </button>
              </li>
              <li>
                <button onClick={scrollToUpload} className="hover:text-white transition">
                  APA / MLA Citations
                </button>
              </li>
              <li>
                <button onClick={scrollToUpload} className="hover:text-white transition">
                  PDF Report Generation
                </button>
              </li>
            </ul>
          </div>

          {/* Integrations & Standards Column */}
          <div>
            <h4 className="text-sm font-bold text-white mb-4 tracking-wide">
              Standards
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-400">
              <li className="hover:text-white transition cursor-default">Turnitin Compatibility</li>
              <li className="hover:text-white transition cursor-default">ArXiv Preprint Repository</li>
              <li className="hover:text-white transition cursor-default">CrossRef DOI Resolution</li>
              <li className="hover:text-white transition cursor-default">JSTOR Academic Citations</li>
              <li className="hover:text-white transition cursor-default">IEEE / MLA Guidelines</li>
            </ul>
          </div>

          {/* Social Column (Matching User Reference Image) */}
          <div>
            <h4 className="text-sm font-bold text-white mb-4 tracking-wide">
              Social
            </h4>
            <ul className="space-y-3.5 text-xs text-slate-300">
              {/* LinkedIn */}
              <li>
                <a
                  href="https://linkedin.com"
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-center space-x-2.5 text-slate-300 hover:text-white transition"
                >
                  <span className="w-6 h-6 rounded-md bg-[#0077b5]/20 flex items-center justify-center text-[#0077b5] group-hover:bg-[#0077b5] group-hover:text-white transition">
                    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76a1.64 1.64 0 1 0 0-3.28 1.64 1.64 0 0 0 0 3.28m1.4 9.74v-8.37H5.06v8.37h2.8z" />
                    </svg>
                  </span>
                  <span className="font-medium group-hover:underline underline-offset-2">LinkedIn</span>
                </a>
              </li>

              {/* YouTube */}
              <li>
                <a
                  href="https://youtube.com"
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-center space-x-2.5 text-slate-300 hover:text-white transition"
                >
                  <span className="w-6 h-6 rounded-md bg-[#ff0000]/20 flex items-center justify-center text-[#ff0000] group-hover:bg-[#ff0000] group-hover:text-white transition">
                    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                    </svg>
                  </span>
                  <span className="font-medium group-hover:underline underline-offset-2">YouTube</span>
                </a>
              </li>

              {/* GitHub */}
              <li>
                <a
                  href="https://github.com"
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-center space-x-2.5 text-slate-300 hover:text-white transition"
                >
                  <span className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center text-white group-hover:bg-white group-hover:text-slate-900 transition">
                    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                    </svg>
                  </span>
                  <span className="font-medium group-hover:underline underline-offset-2">GitHub</span>
                </a>
              </li>

              {/* Twitter (X) */}
              <li>
                <a
                  href="https://twitter.com"
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-center space-x-2.5 text-slate-300 hover:text-white transition"
                >
                  <span className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center text-white group-hover:bg-white group-hover:text-black transition">
                    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  </span>
                  <span className="font-medium group-hover:underline underline-offset-2">Twitter (X)</span>
                </a>
              </li>

              {/* Facebook */}
              <li>
                <a
                  href="https://facebook.com"
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-center space-x-2.5 text-slate-300 hover:text-white transition"
                >
                  <span className="w-6 h-6 rounded-md bg-[#1877f2]/20 flex items-center justify-center text-[#1877f2] group-hover:bg-[#1877f2] group-hover:text-white transition">
                    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                  </span>
                  <span className="font-medium group-hover:underline underline-offset-2">Facebook</span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer Bottom Bar */}
        <div className="max-w-7xl mx-auto pt-8 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <p>&copy; {new Date().getFullYear()} Veritas Originality Technologies Inc. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-6">
            <span className="hover:text-slate-300 transition cursor-pointer">Privacy Policy</span>
            <span className="hover:text-slate-300 transition cursor-pointer">Terms of Service</span>
            <span className="hover:text-slate-300 transition cursor-pointer">Academic Standards</span>
            <span className="hover:text-slate-300 transition cursor-pointer">Security & Encryption</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
