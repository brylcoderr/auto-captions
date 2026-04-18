// Groq Transcription Logic
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { gsap } from 'gsap';
import { Notyf } from 'notyf';
import 'notyf/notyf.min.css';
import hotkeys from 'hotkeys-js';

// --- Notyf Toast Instance ---
const notyf = new Notyf({
  duration: 3500,
  position: { x: 'right', y: 'top' },
  types: [
    {
      type: 'success',
      background: 'linear-gradient(135deg, #10b981, #059669)',
      icon: { className: 'notyf-icon', tagName: 'span', text: '✓' }
    },
    {
      type: 'error',
      background: 'linear-gradient(135deg, #ef4444, #dc2626)',
      icon: { className: 'notyf-icon', tagName: 'span', text: '✕' }
    },
    {
      type: 'warning',
      background: 'linear-gradient(135deg, #f59e0b, #d97706)',
      icon: { className: 'notyf-icon', tagName: 'span', text: '⚠' }
    },
    {
      type: 'info',
      background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
      icon: { className: 'notyf-icon', tagName: 'span', text: 'ℹ' }
    }
  ]
});

// Extend notyf with custom types
notyf.warn = (msg) => notyf.open({ type: 'warning', message: msg });
notyf.info = (msg) => notyf.open({ type: 'info', message: msg });

// --- Configuration & Constants ---
const DEFAULT_SYSTEM_PROMPT = `You are an intelligent auto-caption generation assistant. Analyze the video and return precise captions in the requested JSON format. Always detect language automatically. Return only valid JSON.`;

const RTL_LANGUAGES = ['ar', 'he', 'fa', 'ur', 'sd', 'ps', 'ku'];

// --- DOM Elements ---
const videoUpload = document.getElementById('videoUpload');
const uploadContainer = document.getElementById('uploadContainer');
const videoPreviewContainer = document.getElementById('videoPreviewContainer');
const mainVideo = document.getElementById('mainVideo');
const captionOverlay = document.getElementById('captionOverlay');
const captionContainer = document.getElementById('captionContainer');
const captionText = document.getElementById('captionText');
const generateBtn = document.getElementById('generateBtn');
const resetBtn = document.getElementById('resetBtn');
const processingStatus = document.getElementById('processingStatus');
const statusLabel = document.getElementById('statusLabel');
const progressBar = document.getElementById('progressBar');
const progressPercent = document.getElementById('progressPercent');

// Settings Elements
const settings = {
  fontFamily: document.getElementById('fontFamily'),
  fontSize: document.getElementById('fontSize'),
  fontWeight: document.getElementById('fontWeight'),
  textColor: document.getElementById('textColor'),
  bgColor: document.getElementById('bgColor'),
  bgOpacity: document.getElementById('bgOpacity'),
  vPos: document.getElementById('vPos'),
  hPos: document.getElementById('hPos'),
  animType: document.getElementById('animType'),
  animSpeed: document.getElementById('animSpeed'),
  speekDiarization: document.getElementById('speekDiarization'),
  noiseReduction: document.getElementById('noiseReduction'),
  soundLabels: document.getElementById('soundLabels'),
  customFontName: document.getElementById('customFontName'),
  loadFontBtn: document.getElementById('loadFontBtn'),
  exportBtn: document.getElementById('exportBtn'),
  exportSrtBtn: document.getElementById('exportSrtBtn'),
  // New text customization controls
  letterSpacing: document.getElementById('letterSpacing'),
  lineHeight: document.getElementById('lineHeight'),
  textShadow: document.getElementById('textShadow'),
  textStroke: document.getElementById('textStroke'),
  strokeColor: document.getElementById('strokeColor'),
  textDecoration: document.getElementById('textDecoration'),
  borderRadius: document.getElementById('borderRadius'),
  captionPadding: document.getElementById('captionPadding'),
  captionMaxWidth: document.getElementById('captionMaxWidth'),
  boxBorder: document.getElementById('boxBorder'),
  boxShadow: document.getElementById('boxShadow'),
  wordHighlight: document.getElementById('wordHighlight'),
  highlightColor: document.getElementById('highlightColor'),
  captionMode: document.getElementById('captionMode'),
};

// --- State ---
let currentVideoFile = null;
let captionsData = [];
let wordsData = [];  // Word-level timestamps from Whisper
let metadata = null;
let currentCaptionId = -1;
let currentWordIndex = -1;
let currentTextTransform = 'none';
let currentFontStyle = 'normal';

// --- Style Presets ---
const STYLE_PRESETS = {
  default: {
    fontFamily: "'Outfit', sans-serif",
    fontSize: 24, fontWeight: '700',
    textColor: '#ffffff', bgColor: '#000000', bgOpacity: 0.6,
    textShadow: 'none', textStroke: '0', strokeColor: '#000000',
    textTransform: 'none', fontStyle: 'normal',
    letterSpacing: 0, lineHeight: 1.4,
    borderRadius: 8, captionPadding: 10, captionMaxWidth: 80,
    boxBorder: 'none', boxShadow: 'none',
    textDecoration: 'none', animType: 'fade'
  },
  cinematic: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 26, fontWeight: '400',
    textColor: '#f8fafc', bgColor: '#000000', bgOpacity: 0.0,
    textShadow: '0 2px 10px rgba(0,0,0,0.9)', textStroke: '0', strokeColor: '#000000',
    textTransform: 'none', fontStyle: 'italic',
    letterSpacing: 1, lineHeight: 1.5,
    borderRadius: 0, captionPadding: 10, captionMaxWidth: 70,
    boxBorder: 'none', boxShadow: 'none',
    textDecoration: 'none', animType: 'fade'
  },
  bold: {
    fontFamily: "'Anton', sans-serif",
    fontSize: 32, fontWeight: '400',
    textColor: '#fbbf24', bgColor: '#000000', bgOpacity: 0.8,
    textShadow: '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000',
    textStroke: '0', strokeColor: '#000000',
    textTransform: 'uppercase', fontStyle: 'normal',
    letterSpacing: 2, lineHeight: 1.2,
    borderRadius: 4, captionPadding: 12, captionMaxWidth: 90,
    boxBorder: '2px solid #fbbf24', boxShadow: 'none',
    textDecoration: 'none', animType: 'pop'
  },
  neon: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: 30, fontWeight: '400',
    textColor: '#22d3ee', bgColor: '#0f172a', bgOpacity: 0.5,
    textShadow: '0 0 10px #22d3ee, 0 0 40px #22d3ee, 0 0 80px #22d3ee',
    textStroke: '0', strokeColor: '#000000',
    textTransform: 'uppercase', fontStyle: 'normal',
    letterSpacing: 3, lineHeight: 1.3,
    borderRadius: 12, captionPadding: 14, captionMaxWidth: 80,
    boxBorder: '1px solid rgba(34,211,238,0.3)', boxShadow: '0 0 20px rgba(34,211,238,0.4)',
    textDecoration: 'none', animType: 'blur'
  },
  karaoke: {
    fontFamily: "'Poppins', sans-serif",
    fontSize: 28, fontWeight: '900',
    textColor: '#f472b6', bgColor: '#000000', bgOpacity: 0.0,
    textShadow: '0 2px 4px rgba(0,0,0,0.8)', textStroke: '2', strokeColor: '#ffffff',
    textTransform: 'uppercase', fontStyle: 'normal',
    letterSpacing: 1, lineHeight: 1.3,
    borderRadius: 0, captionPadding: 8, captionMaxWidth: 90,
    boxBorder: 'none', boxShadow: 'none',
    textDecoration: 'none', animType: 'scale'
  },
  retro: {
    fontFamily: "'Bungee', sans-serif",
    fontSize: 22, fontWeight: '400',
    textColor: '#fb923c', bgColor: '#1e293b', bgOpacity: 0.7,
    textShadow: '3px 3px 0 rgba(0,0,0,0.3)', textStroke: '0', strokeColor: '#000000',
    textTransform: 'uppercase', fontStyle: 'normal',
    letterSpacing: 2, lineHeight: 1.4,
    borderRadius: 4, captionPadding: 12, captionMaxWidth: 85,
    boxBorder: '2px solid #fb923c', boxShadow: 'none',
    textDecoration: 'none', animType: 'slide'
  },
  handwritten: {
    fontFamily: "'Caveat', cursive",
    fontSize: 32, fontWeight: '700',
    textColor: '#ffffff', bgColor: '#000000', bgOpacity: 0.0,
    textShadow: '0 2px 10px rgba(0,0,0,0.9)', textStroke: '0', strokeColor: '#000000',
    textTransform: 'none', fontStyle: 'normal',
    letterSpacing: 0.5, lineHeight: 1.4,
    borderRadius: 0, captionPadding: 8, captionMaxWidth: 75,
    boxBorder: 'none', boxShadow: 'none',
    textDecoration: 'none', animType: 'fade'
  },
  news: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: 20, fontWeight: '600',
    textColor: '#ffffff', bgColor: '#dc2626', bgOpacity: 0.9,
    textShadow: 'none', textStroke: '0', strokeColor: '#000000',
    textTransform: 'uppercase', fontStyle: 'normal',
    letterSpacing: 1, lineHeight: 1.3,
    borderRadius: 2, captionPadding: 10, captionMaxWidth: 90,
    boxBorder: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
    textDecoration: 'none', animType: 'slide'
  },

  // ═══ CREATOR PRESETS ═══
  mrbeast: {
    fontFamily: "'Montserrat', sans-serif",
    fontSize: 38, fontWeight: '900',
    textColor: '#ffffff', bgColor: '#000000', bgOpacity: 0.0,
    textShadow: '3px 3px 0 #000, -3px -3px 0 #000, 3px -3px 0 #000, -3px 3px 0 #000, 0 3px 0 #000, 3px 0 0 #000, -3px 0 0 #000, 0 -3px 0 #000',
    textStroke: '3', strokeColor: '#000000',
    textTransform: 'uppercase', fontStyle: 'normal',
    letterSpacing: 1, lineHeight: 1.2,
    borderRadius: 0, captionPadding: 6, captionMaxWidth: 90,
    boxBorder: 'none', boxShadow: 'none',
    textDecoration: 'none', animType: 'pop',
    captionMode: 'word', highlightColor: '#fbbf24'
  },
  hormozi: {
    fontFamily: "'Montserrat', sans-serif",
    fontSize: 34, fontWeight: '800',
    textColor: '#ffffff', bgColor: '#000000', bgOpacity: 0.85,
    textShadow: 'none', textStroke: '0', strokeColor: '#000000',
    textTransform: 'uppercase', fontStyle: 'normal',
    letterSpacing: 0.5, lineHeight: 1.25,
    borderRadius: 4, captionPadding: 12, captionMaxWidth: 85,
    boxBorder: 'none', boxShadow: '0 6px 25px rgba(0,0,0,0.5)',
    textDecoration: 'none', animType: 'pop',
    captionMode: 'highlight', highlightColor: '#facc15'
  },
  aliabdaal: {
    fontFamily: "'Lexend', sans-serif",
    fontSize: 22, fontWeight: '500',
    textColor: '#f1f5f9', bgColor: '#1e293b', bgOpacity: 0.75,
    textShadow: '0 1px 3px rgba(0,0,0,0.4)', textStroke: '0', strokeColor: '#000000',
    textTransform: 'none', fontStyle: 'normal',
    letterSpacing: 0, lineHeight: 1.5,
    borderRadius: 12, captionPadding: 12, captionMaxWidth: 70,
    boxBorder: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
    textDecoration: 'none', animType: 'fade',
    captionMode: 'sentence'
  },
  mkbhd: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: 24, fontWeight: '600',
    textColor: '#ffffff', bgColor: '#000000', bgOpacity: 0.0,
    textShadow: '0 2px 8px rgba(0,0,0,0.9)', textStroke: '0', strokeColor: '#000000',
    textTransform: 'none', fontStyle: 'normal',
    letterSpacing: 0, lineHeight: 1.4,
    borderRadius: 0, captionPadding: 8, captionMaxWidth: 75,
    boxBorder: 'none', boxShadow: 'none',
    textDecoration: 'none', animType: 'fade',
    captionMode: 'sentence'
  },
  casey: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: 36, fontWeight: '400',
    textColor: '#ffffff', bgColor: '#000000', bgOpacity: 0.0,
    textShadow: '2px 2px 0 rgba(0,0,0,0.9), 0 0 20px rgba(0,0,0,0.5)',
    textStroke: '0', strokeColor: '#000000',
    textTransform: 'uppercase', fontStyle: 'normal',
    letterSpacing: 3, lineHeight: 1.2,
    borderRadius: 0, captionPadding: 6, captionMaxWidth: 80,
    boxBorder: 'none', boxShadow: 'none',
    textDecoration: 'none', animType: 'slide',
    captionMode: 'word'
  },
  tiktok: {
    fontFamily: "'Poppins', sans-serif",
    fontSize: 32, fontWeight: '900',
    textColor: '#ffffff', bgColor: '#000000', bgOpacity: 0.0,
    textShadow: '0 0 8px rgba(0,0,0,0.8)', textStroke: '2', strokeColor: '#000000',
    textTransform: 'uppercase', fontStyle: 'normal',
    letterSpacing: 0.5, lineHeight: 1.2,
    borderRadius: 0, captionPadding: 6, captionMaxWidth: 90,
    boxBorder: 'none', boxShadow: 'none',
    textDecoration: 'none', animType: 'pop',
    captionMode: 'highlight', highlightColor: '#00f2ea'
  }
};

// --- Initialization ---
function init() {
  setupTabs();
  attachEventListeners();
  setupDragDrop();
  setupPresets();
  setupSegmentedControls();
  setupColorSwatches();
  setupKeyboardShortcuts();
  applySettingsToPreview(); // Initial sync
  // Default: let clicks pass through to video controls
  captionContainer.style.pointerEvents = 'none';
}

// --- Tab Switching ---
function setupTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab;

      // Deactivate all
      tabButtons.forEach(b => b.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));

      // Activate clicked
      btn.classList.add('active');
      const panel = document.getElementById(`tab-${targetTab}`);
      if (panel) {
        panel.classList.add('active');
        // Re-trigger animation
        panel.style.animation = 'none';
        panel.offsetHeight; // force reflow
        panel.style.animation = '';
      }
    });
  });
}

function attachEventListeners() {
  videoUpload.addEventListener('change', handleFileUpload);
  
  resetBtn.addEventListener('click', () => {
    location.reload(); // Simple reset
  });

  generateBtn.addEventListener('click', generateCaptions);

  // SRT Import Listeners
  const importSrtBtn = document.getElementById('importSrtBtn');
  const srtUpload = document.getElementById('srtUpload');
  
  if (importSrtBtn && srtUpload) {
    importSrtBtn.addEventListener('click', () => srtUpload.click());
    srtUpload.addEventListener('change', handleSrtUpload);
  }

  mainVideo.addEventListener('timeupdate', updateCaptions);

  // Live Settings Listeners — bind to all <select>, <input>, <range> controls
  const liveSettingIds = [
    'fontFamily', 'fontSize', 'fontWeight', 'textColor', 'bgColor', 'bgOpacity',
    'vPos', 'hPos', 'animType', 'animSpeed',
    'letterSpacing', 'lineHeight', 'textShadow', 'textStroke', 'strokeColor',
    'textDecoration', 'borderRadius', 'captionPadding', 'captionMaxWidth',
    'boxBorder', 'boxShadow', 'highlightColor', 'captionMode'
  ];

  liveSettingIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', () => {
        applySettingsToPreview();
        updateRangeLabels();
      });
    }
  });

  // Word highlight toggle
  settings.wordHighlight.addEventListener('change', () => {
    const row = document.getElementById('highlightColorRow');
    row.style.display = settings.wordHighlight.checked ? 'flex' : 'none';
    applySettingsToPreview();
  });

  settings.loadFontBtn.addEventListener('click', loadCustomFont);
  settings.exportBtn.addEventListener('click', () => {
    if (!captionsData.length) return notyf.warn("Generate captions first!");
    startBurnInExport();
  });
  settings.exportSrtBtn.addEventListener('click', () => {
    if (!captionsData.length) return notyf.warn("Generate captions first!");
    downloadSRT();
  });

  // Shortcuts button
  document.getElementById('shortcutsBtn').addEventListener('click', toggleShortcutsPanel);

  setupCaptionInteractions();
}

function updateRangeLabels() {
  const labelMap = {
    bgOpacity: 'bgOpacityValue',
    letterSpacing: 'letterSpacingValue',
    lineHeight: 'lineHeightValue',
    borderRadius: 'borderRadiusValue',
    captionPadding: 'captionPaddingValue',
    captionMaxWidth: 'maxWidthValue',
    animSpeed: 'animSpeedValue'
  };

  for (const [inputId, labelId] of Object.entries(labelMap)) {
    const input = document.getElementById(inputId);
    const label = document.getElementById(labelId);
    if (input && label) {
      label.textContent = input.value;
    }
  }
}

// --- Drag & Drop for Upload ---
function setupDragDrop() {
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    uploadContainer.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    uploadContainer.addEventListener(eventName, () => {
      uploadContainer.classList.add('drag-over');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    uploadContainer.addEventListener(eventName, () => {
      uploadContainer.classList.remove('drag-over');
    });
  });

  uploadContainer.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length) {
      const file = files[0];
      const validTypes = ['video/mp4', 'video/quicktime', 'video/webm', 'audio/mpeg', 'audio/wav', 'audio/mp4'];
      if (validTypes.includes(file.type)) {
        currentVideoFile = file;
        // Trigger the same handler
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        videoUpload.files = dataTransfer.files;
        handleFileUpload({ target: videoUpload });
        notyf.success(`"${file.name}" loaded!`);
      } else {
        notyf.error('Unsupported file type. Use MP4, MOV, WebM, MP3, or WAV.');
      }
    }
  });

  // Also make the upload area clickable, but ignore clicks on the button to prevent duplicate popups
  uploadContainer.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
    videoUpload.click();
  });
}

// --- Style Presets ---
function setupPresets() {
  const buttons = document.querySelectorAll('.preset-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const presetName = btn.dataset.preset;
      applyPreset(presetName);
      
      // Update active state
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      notyf.info(`"${btn.querySelector('.preset-label').textContent}" preset applied`);
    });
  });
}

function applyPreset(name) {
  const preset = STYLE_PRESETS[name];
  if (!preset) return;

  // Apply values to form controls
  settings.fontFamily.value = preset.fontFamily;
  settings.fontSize.value = preset.fontSize;
  settings.fontWeight.value = preset.fontWeight;
  settings.textColor.value = preset.textColor;
  settings.bgColor.value = preset.bgColor;
  settings.bgOpacity.value = preset.bgOpacity;
  settings.textShadow.value = preset.textShadow;
  settings.textStroke.value = preset.textStroke;
  settings.strokeColor.value = preset.strokeColor;
  settings.textDecoration.value = preset.textDecoration;
  settings.borderRadius.value = preset.borderRadius;
  settings.captionPadding.value = preset.captionPadding;
  settings.captionMaxWidth.value = preset.captionMaxWidth;
  settings.boxBorder.value = preset.boxBorder;
  settings.boxShadow.value = preset.boxShadow;
  settings.animType.value = preset.animType;
  settings.letterSpacing.value = preset.letterSpacing;
  settings.lineHeight.value = preset.lineHeight;

  // Caption mode (creator presets can set this)
  if (preset.captionMode && settings.captionMode) {
    settings.captionMode.value = preset.captionMode;
  }

  // Highlight color (creator presets can set this)
  if (preset.highlightColor && settings.highlightColor) {
    settings.highlightColor.value = preset.highlightColor;
  }

  // Text transform
  currentTextTransform = preset.textTransform;
  document.querySelectorAll('#textTransformControl .seg-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.value === preset.textTransform);
  });

  // Font style
  currentFontStyle = preset.fontStyle;
  document.querySelectorAll('#fontStyleControl .seg-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.value === preset.fontStyle);
  });

  updateRangeLabels();
  applySettingsToPreview();
}

// --- Segmented Controls ---
function setupSegmentedControls() {
  // Text Transform
  document.querySelectorAll('#textTransformControl .seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#textTransformControl .seg-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTextTransform = btn.dataset.value;
      applySettingsToPreview();
    });
  });

  // Font Style
  document.querySelectorAll('#fontStyleControl .seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#fontStyleControl .seg-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFontStyle = btn.dataset.value;
      applySettingsToPreview();
    });
  });
}

// --- Color Swatches ---
function setupColorSwatches() {
  document.querySelectorAll('.color-swatches').forEach(group => {
    const targetId = group.dataset.target;
    const targetInput = document.getElementById(targetId);
    
    group.querySelectorAll('.swatch').forEach(swatch => {
      swatch.addEventListener('click', () => {
        targetInput.value = swatch.dataset.color;
        applySettingsToPreview();
      });
    });
  });
}

// --- Keyboard Shortcuts ---
function setupKeyboardShortcuts() {
  // Allow hotkeys to work even when input/select/textarea are focused for specific keys
  hotkeys.filter = function(event) {
    const tag = event.target.tagName;
    // Block all shortcuts when typing in text inputs
    if (tag === 'INPUT' || tag === 'TEXTAREA') {
      // Only allow '?' in inputs
      if (event.key === '?') return true;
      return false;
    }
    return true;
  };

  // Play/Pause
  hotkeys('space', (e) => {
    e.preventDefault();
    if (mainVideo.paused) {
      mainVideo.play();
    } else {
      mainVideo.pause();
    }
  });

  // Generate captions
  hotkeys('g', (e) => {
    e.preventDefault();
    if (!generateBtn.disabled) generateBtn.click();
  });

  // Export video
  hotkeys('e', (e) => {
    e.preventDefault();
    settings.exportBtn.click();
  });

  // Export SRT
  hotkeys('s', (e) => {
    e.preventDefault();
    settings.exportSrtBtn.click();
  });

  // Reset
  hotkeys('r', (e) => {
    e.preventDefault();
    resetBtn.click();
  });

  // Seek forward/backward
  hotkeys('left', (e) => {
    e.preventDefault();
    mainVideo.currentTime = Math.max(0, mainVideo.currentTime - 5);
  });

  hotkeys('right', (e) => {
    e.preventDefault();
    mainVideo.currentTime = Math.min(mainVideo.duration, mainVideo.currentTime + 5);
  });

  // Volume up/down
  hotkeys('up', (e) => {
    e.preventDefault();
    mainVideo.volume = Math.min(1, mainVideo.volume + 0.1);
    notyf.info(`Volume: ${Math.round(mainVideo.volume * 100)}%`);
  });

  hotkeys('down', (e) => {
    e.preventDefault();
    mainVideo.volume = Math.max(0, mainVideo.volume - 0.1);
    notyf.info(`Volume: ${Math.round(mainVideo.volume * 100)}%`);
  });

  // Quick presets (1-5)
  const presetKeys = ['default', 'cinematic', 'bold', 'neon', 'karaoke', 'retro', 'handwritten', 'news'];
  for (let i = 1; i <= 8; i++) {
    hotkeys(`${i}`, (e) => {
      e.preventDefault();
      const presetName = presetKeys[i - 1];
      if (presetName) {
        applyPreset(presetName);
        document.querySelectorAll('.preset-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.preset === presetName);
        });
        notyf.info(`Preset: ${presetName}`);
      }
    });
  }

  // Toggle shortcuts panel
  hotkeys('shift+/', (e) => {
    e.preventDefault();
    toggleShortcutsPanel();
  });
}

function toggleShortcutsPanel() {
  const panel = document.getElementById('shortcutsTooltip');
  if (panel.style.display === 'none') {
    panel.style.display = 'block';
  } else {
    panel.style.display = 'none';
  }
}

function setupCaptionInteractions() {
  // Editing
  captionText.setAttribute('contenteditable', 'true');
  captionText.addEventListener('input', () => {
    if (currentCaptionId !== -1) {
      const cap = captionsData.find(c => c.id === currentCaptionId);
      if (cap) cap.text = captionText.textContent;
    }
  });

  // Dragging
  let isDragging = false;
  let offsetX, offsetY;

  captionContainer.addEventListener('mousedown', (e) => {
    // Check if we are clicking the text to edit it
    const isTextClick = e.target === captionText || e.target.closest('#captionText');
    
    // Allow dragging if clicking outside the text, or if holding Shift while clicking text
    if (isTextClick && !e.shiftKey) return; 

    isDragging = true;
    const rect = captionContainer.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    
    captionContainer.style.cursor = 'grabbing';
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    const overlayRect = captionOverlay.getBoundingClientRect();
    
    let x = e.clientX - overlayRect.left - offsetX;
    let y = e.clientY - overlayRect.top - offsetY;
    
    // Constraints
    const capRect = captionContainer.getBoundingClientRect();
    x = Math.max(0, Math.min(x, overlayRect.width - capRect.width));
    y = Math.max(0, Math.min(y, overlayRect.height - capRect.height));
    
    captionContainer.style.left = x + 'px';
    captionContainer.style.top = y + 'px';
    captionContainer.style.right = 'auto';
    captionContainer.style.bottom = 'auto';
    captionContainer.style.margin = '0';
    captionContainer.style.transform = 'none'; // Prevent GSAP conflicts during drag
  });

  window.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      captionContainer.style.cursor = 'move';
    }
  });
}

// --- Video Handling ---
function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  currentVideoFile = file;
  const isAudio = file.type.startsWith('audio');
  const visualizer = document.getElementById('audioVisualizer');

  // Revoke previous object URL if any
  if (mainVideo.src && mainVideo.src.startsWith('blob:')) {
    URL.revokeObjectURL(mainVideo.src);
  }

  uploadContainer.style.display = 'none';
  videoPreviewContainer.style.display = 'block';

  // Assign ALL handlers BEFORE setting src to prevent race conditions
  mainVideo.onloadedmetadata = () => {
    console.log("Video loaded:", mainVideo.videoWidth, "x", mainVideo.videoHeight, ",", mainVideo.duration, "s");
    syncOverlaySize();
    // Seek slightly to render first frame (fixes black screen on some codecs)
    mainVideo.currentTime = 0.1;
    notyf.success(`Video loaded (${Math.round(mainVideo.duration)}s)`);
  };

  mainVideo.onerror = (err) => {
    console.error("Video Error:", err);
    notyf.error("Error loading video. Try a different format.");
  };

  window.addEventListener('resize', syncOverlaySize);

  // Now set the source AFTER handlers are attached
  if (isAudio) {
    mainVideo.style.display = 'none';
    visualizer.style.display = 'flex';
    mainVideo.src = URL.createObjectURL(file);
    notyf.success("Audio loaded.");
  } else {
    mainVideo.style.display = 'block';
    visualizer.style.display = 'none';
    mainVideo.src = URL.createObjectURL(file);
    mainVideo.load();
  }
}

// --- SRT Import Handling ---
function handleSrtUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    const srtText = event.target.result;
    
    // Quick and robust SRT parser
    const segments = [];
    const blocks = srtText.trim().replace(/\r\n/g, '\n').split(/\n\s*\n/);
    
    for (const block of blocks) {
      const lines = block.split('\n');
      if (lines.length >= 3) {
        let timeLineObj = lines.find(line => line.includes('-->'));
        if (!timeLineObj) continue;

        const timeLineIndex = lines.indexOf(timeLineObj);
        const textLines = lines.slice(timeLineIndex + 1).join(' ');
        
        const timeParts = timeLineObj.split('-->').map(t => t.trim());
        if (timeParts.length === 2) {
          segments.push({
            id: segments.length,
            start: timeParts[0].replace(',', '.'), // Normalize comma to dot
            end: timeParts[1].replace(',', '.'),
            text: textLines.trim(),
            confidence: 1.0
          });
        }
      }
    }

    if (segments.length === 0) {
      notyf.error("Could not parse subtitles. Ensure it's a valid SRT file.");
      return;
    }

    // Format structure to mimic the Groq pipeline output
    const mockGroqData = {
      detected_language: "en",
      language_name: "Imported SRT",
      duration_seconds: mainVideo.duration || 0,
      captions: segments,
      words: [] // Words array empty => will trigger auto-generation in processResponseData
    };

    processResponseData(mockGroqData);
    notyf.success(`Successfully imported ${segments.length} captions!`);
    
    // Play video to preview
    mainVideo.currentTime = timeToSeconds(segments[0].start);
    mainVideo.play();
  };
  
  reader.readAsText(file);
  e.target.value = ''; // Reset input to allow re-uploading same file
}

// --- Caption Generation Logic ---
async function generateCaptions() {
  if (!currentVideoFile) return;

  const envKey = import.meta.env.VITE_GROQ_API_KEY;
  let apiKey = envKey;

  if (!apiKey) {
    apiKey = prompt("Please enter your Groq API Key to continue (or type 'demo' to see sample captions):");
  }

  if (!apiKey) return;

  generateBtn.disabled = true;
  processingStatus.style.display = 'block';
  updateProgress(10, "Extracting audio...");

  if (apiKey.toLowerCase() === 'demo') {
    handleDemoMode();
    return;
  }

  try {
    const totalDuration = mainVideo.duration || 0;
    // 1200s = 20 minutes chunk. At 64kbps, 20 mins is ~9.6MB (well under 25MB)
    const CHUNK_SIZE = 1200; 
    const numChunks = Math.max(1, Math.ceil(totalDuration / CHUNK_SIZE));

    let allSegments = [];
    let allWords = [];
    let detectedLanguage = "en";
    let combinedDuration = 0;

    for (let i = 0; i < numChunks; i++) {
      const startSec = i * CHUNK_SIZE;
      
      let fileToUpload = currentVideoFile;
      const isAudio = currentVideoFile.type.startsWith('audio');
      
      updateProgress(10 + (i/numChunks)*20, `Extracting audio chunk ${i+1}/${numChunks}...`);
      
      // We always extract/chunk for video. For pure audio files over 25MB, we chunk too.
      if (!isAudio || (isAudio && totalDuration > CHUNK_SIZE)) {
        fileToUpload = await extractAudioFromVideo(currentVideoFile, startSec, CHUNK_SIZE);
      } // If it's a small audio file, we just send it as-is on the first pass
      
      if (fileToUpload.size > 25 * 1024 * 1024) {
        throw new Error(`Chunk ${i+1} is still larger than 25MB. Please check video constraints.`);
      }

      updateProgress(30 + (i/numChunks)*50, `Transcribing chunk ${i+1}/${numChunks}...`);

      const formData = new FormData();
      formData.append('file', fileToUpload);
      formData.append('model', 'whisper-large-v3-turbo');
      formData.append('response_format', 'verbose_json');
      formData.append('timestamp_granularities[]', 'word');
      formData.append('timestamp_granularities[]', 'segment');

      const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}` },
        body: formData
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error?.message || "Groq API error");
      }

      const chunkData = await response.json();
      
      if (i === 0) detectedLanguage = chunkData.language || "en";
      combinedDuration += chunkData.duration || CHUNK_SIZE;

      // Offset timestamps
      const offsetSegments = (chunkData.segments || []).map(seg => ({
        ...seg,
        start: seg.start + startSec,
        end: seg.end + startSec
      }));
      
      const offsetWords = (chunkData.words || []).map(w => ({
        ...w,
        start: w.start + startSec,
        end: w.end + startSec
      }));

      allSegments.push(...offsetSegments);
      allWords.push(...offsetWords);
    }

    updateProgress(85, "Structuring complete captions...");

    const combinedData = {
      language: detectedLanguage,
      duration: combinedDuration,
      segments: allSegments.map((s, idx) => ({ ...s, id: idx })),
      words: allWords
    };

    const formattedData = formatGroqResponse(combinedData);
    processResponseData(formattedData);
    
    updateProgress(100, "Captions generated with Groq!");
    notyf.success(`${formattedData.captions.length} captions generated!`);
    
    setTimeout(() => {
      processingStatus.style.display = 'none';
      mainVideo.play();
    }, 1500);

  } catch (error) {
    console.error("Transcription error:", error);
    notyf.error("Error: " + error.message);
    statusLabel.textContent = "Error: " + error.message;
    statusLabel.style.color = "#ef4444";
    generateBtn.disabled = false;
  }
}

function formatGroqResponse(whisperData) {
  const wordsList = whisperData.words || [];
  let newSegments = [];
  
  // Construct dynamic shorts-style segments (Max 4 words per caption)
  if (wordsList.length > 0) {
    let currentChunk = [];
    wordsList.forEach((w, index) => {
      currentChunk.push(w);
      const isLastWord = index === wordsList.length - 1;
      
      // Split if we hit 4 words, OR if there's a big silence (>1s gap) between words, OR if it's the last word
      const nextWord = !isLastWord ? wordsList[index + 1] : null;
      const isBigGap = nextWord && (nextWord.start - w.end > 1.0);

      if (currentChunk.length === 4 || isBigGap || isLastWord) {
        newSegments.push({
          id: newSegments.length,
          start: secondsToTimestamp(currentChunk[0].start),
          end: secondsToTimestamp(currentChunk[currentChunk.length - 1].end),
          text: currentChunk.map(cw => cw.word.trim()).join(' '),
          confidence: 0.95
        });
        currentChunk = [];
      }
    });
  } else {
    // Fallback if API omitted word timestamps for some reason
    newSegments = (whisperData.segments || []).map(seg => ({
      id: seg.id,
      start: secondsToTimestamp(seg.start),
      end: secondsToTimestamp(seg.end),
      text: seg.text.trim(),
      confidence: 0.95
    }));
  }

  return {
    detected_language: whisperData.language || "en",
    language_name: whisperData.language || "English",
    duration_seconds: whisperData.duration,
    captions: newSegments,
    words: wordsList.map((w, i) => ({
      id: i,
      word: w.word.trim(),
      start: w.start,
      end: w.end
    }))
  };
}

function secondsToTimestamp(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}.${ms.toString().padStart(3,'0')}`;
}

// --- Helper Functions ---
async function fileToGenerativePart(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve({
        data: reader.result.split(',')[1],
        mimeType: file.type,
      });
    };
    reader.readAsDataURL(file);
  });
}

let ffmpeg = null;

async function getFFmpeg() {
  if (!ffmpeg) {
    ffmpeg = new FFmpeg();
  }
  if (!ffmpeg.loaded) {
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
  }
  return ffmpeg;
}

async function extractAudioFromVideo(file, startSec = 0, durationSec = null) {
  try {
    const ff = await getFFmpeg();
    const name = 'input_video';
    
    // Optimization: only write file if startSec is 0 (first chunk) to save memory/time
    if (startSec === 0) {
      await ff.writeFile(name, await fetchFile(file));
    }
    
    // Extract audio chunk at 64kbps to fit 25MB
    let args = [];
    if (durationSec !== null) {
      args = ['-ss', startSec.toString(), '-i', name, '-t', durationSec.toString(), '-vn', '-ab', '64k', '-ar', '16000', 'output.mp3'];
    } else {
      args = ['-i', name, '-vn', '-ab', '64k', '-ar', '16000', 'output.mp3'];
    }
    
    await ff.exec(args);
    const data = await ff.readFile('output.mp3');
    return new File([data.buffer], `audio_chunk_${startSec}.mp3`, { type: 'audio/mp3' });
  } catch (error) {
    console.error("FFmpeg Load Error:", error);
    throw new Error("FFmpeg could not be initialized. Your browser may lack support for modern video processing features.");
  }
}

function timeToSeconds(timeStr) {
  const parts = timeStr.split(':');
  const secondsParts = parts[2].split('.');
  const h = parseInt(parts[0], 10) * 3600;
  const m = parseInt(parts[1], 10) * 60;
  const s = parseInt(secondsParts[0], 10);
  const ms = parseInt(secondsParts[1], 10) / 1000;
  return h + m + s + ms;
}

function updateProgress(percent, text) {
  progressBar.style.width = percent + '%';
  progressPercent.textContent = percent + '%';
  statusLabel.textContent = text;
}

function handleDemoMode() {
  updateProgress(40, "Simulating AI analysis...");
  setTimeout(() => {
    // Generate word-level timestamps for demo
    const demoSentences = [
      { id: 1, start: "00:00:00.500", end: "00:00:03.000", text: "Welcome to CaptionPro AI, your ultimate transcription tool." },
      { id: 2, start: "00:00:03.200", end: "00:00:06.500", text: "We use advanced Groq Whisper to generate precise timestamps." },
      { id: 3, start: "00:00:06.700", end: "00:00:10.000", text: "You can customize fonts, colors, and even animations in real-time." },
      { id: 4, start: "00:00:10.200", end: "00:00:13.500", text: "Try the style presets for instant cinematic looks." },
      { id: 5, start: "00:00:13.700", end: "00:00:17.000", text: "Export as video with burned-in subtitles or download SRT files." }
    ];

    // Auto-generate word-level timestamps from sentences
    const demoWords = [];
    demoSentences.forEach(sent => {
      const words = sent.text.split(/\s+/);
      const startSec = timeToSeconds(sent.start);
      const endSec = timeToSeconds(sent.end);
      const wordDuration = (endSec - startSec) / words.length;
      words.forEach((word, i) => {
        demoWords.push({
          id: demoWords.length,
          word: word,
          start: startSec + i * wordDuration,
          end: startSec + (i + 1) * wordDuration
        });
      });
    });

    const demoData = {
      detected_language: "en",
      language_name: "English",
      captions: demoSentences,
      words: demoWords
    };
    processResponseData(demoData);
    updateProgress(100, "Demo captions loaded!");
    notyf.success("5 demo captions loaded! Press play to preview.");
    setTimeout(() => {
      processingStatus.style.display = 'none';
      mainVideo.play();
    }, 1500);
  }, 2000);
}

function processResponseData(data) {
  captionsData = data.captions.map(c => ({
    ...c,
    startTime: timeToSeconds(c.start),
    endTime: timeToSeconds(c.end)
  }));

  // Store word-level timestamps
  wordsData = data.words || [];

  // If no word data came from API, auto-generate from segments
  if (!wordsData.length && captionsData.length) {
    wordsData = [];
    captionsData.forEach(seg => {
      const words = seg.text.split(/\s+/);
      const wordDuration = (seg.endTime - seg.startTime) / words.length;
      words.forEach((word, i) => {
        wordsData.push({
          id: wordsData.length,
          word: word,
          start: seg.startTime + i * wordDuration,
          end: seg.startTime + (i + 1) * wordDuration
        });
      });
    });
  }

  metadata = data;

  // Handle RTL
  if (RTL_LANGUAGES.includes(data.detected_language)) {
    captionContainer.dir = 'rtl';
    settings.hPos.value = 'right';
  } else {
    captionContainer.dir = 'ltr';
  }

  // Render the editable transcript
  renderTranscriptEditor();
}

function renderTranscriptEditor() {
  const container = document.getElementById('transcriptList');
  if (!container) return;
  container.innerHTML = '';

  if (!captionsData.length) {
    container.innerHTML = '<div class="text-muted" style="text-align: center; padding: 2rem 0; font-size: 0.85rem;">No captions generated yet.</div>';
    return;
  }

  captionsData.forEach((caption, index) => {
    const item = document.createElement('div');
    item.className = 'transcript-item';

    const timeRow = document.createElement('div');
    timeRow.className = 'transcript-time';
    // Format "00:00.5" style from "00:00:00.500"
    const startFmt = caption.start.substring(3, 8);
    const endFmt = caption.end.substring(3, 8);
    timeRow.innerHTML = `<span>[${startFmt} - ${endFmt}]</span>`;

    const textArea = document.createElement('textarea');
    textArea.className = 'transcript-text';
    textArea.value = caption.text;
    
    // Auto-resize textarea to fit content initially
    requestAnimationFrame(() => {
      textArea.style.height = textArea.scrollHeight + 'px';
    });

    textArea.addEventListener('input', (e) => {
      // Auto resize height dynamically
      textArea.style.height = 'auto';
      textArea.style.height = textArea.scrollHeight + 'px';

      const newText = e.target.value;
      captionsData[index].text = newText;
      
      // Update wordsData for this specific segment
      const segStart = caption.startTime;
      const segEnd = caption.endTime;
      
      const words = newText.split(/\s+/).filter(w => w.trim());
      const wordDuration = words.length > 0 ? (segEnd - segStart) / words.length : 0;
      
      const newWords = words.map((w, i) => ({
        id: 'w_' + index + '_' + i + '_' + Date.now().toString(36),
        word: w,
        start: segStart + i * wordDuration,
        end: segStart + (i + 1) * wordDuration
      }));

      // Filter out original words that belong to this segment
      wordsData = wordsData.filter(w => !(w.start >= segStart && w.start < segEnd));
      wordsData.push(...newWords);
      wordsData.sort((a, b) => a.start - b.start);

      // Force caption preview update
      if (mainVideo.paused) {
        currentCaptionId = -1;
        currentWordIndex = -1;
        updateCaptions();
      }
    });

    // Seek video when clicking the time
    timeRow.style.cursor = 'pointer';
    timeRow.addEventListener('click', () => {
      mainVideo.currentTime = caption.startTime;
      mainVideo.play();
    });

    item.appendChild(timeRow);
    item.appendChild(textArea);
    container.appendChild(item);
  });
}

function updateCaptions() {
  if (!captionsData.length) return;

  const currentTime = mainVideo.currentTime;
  const captionMode = settings.captionMode ? settings.captionMode.value : 'sentence';

  if (captionMode === 'word') {
    updateWordByWordCaption(currentTime);
    return;
  }

  if (captionMode === 'highlight') {
    updateHighlightCaption(currentTime);
    return;
  }

  // Default: sentence mode
  const activeCaption = captionsData.find(c => currentTime >= c.startTime && currentTime <= c.endTime);

  if (activeCaption) {
    if (currentCaptionId !== activeCaption.id) {
      currentCaptionId = activeCaption.id;
      resetCaptionPosition();
      displayCaption(activeCaption.text, activeCaption);
      captionContainer.style.pointerEvents = 'auto';
      requestAnimationFrame(() => clampCaptionToOverlay());
    }

    // Word highlight update (runs every frame for active caption)
    if (settings.wordHighlight.checked && activeCaption) {
      updateWordHighlight(activeCaption, currentTime);
    }
  } else {
    currentCaptionId = -1;
    captionText.textContent = '';
    captionContainer.style.background = 'transparent';
    captionContainer.style.border = 'none';
    captionContainer.style.boxShadow = 'none';
    captionContainer.style.pointerEvents = 'none';
  }
}

// --- WORD-BY-WORD MODE: Show only the currently spoken word ---
function updateWordByWordCaption(currentTime) {
  const activeWord = wordsData.find(w => currentTime >= w.start && currentTime <= w.end);

  if (activeWord) {
    if (currentWordIndex !== activeWord.id) {
      currentWordIndex = activeWord.id;
      resetCaptionPosition();
      displayCaption(activeWord.word, null);
      captionContainer.style.pointerEvents = 'auto';
      requestAnimationFrame(() => clampCaptionToOverlay());
    }
  } else {
    if (currentWordIndex !== -1) {
      currentWordIndex = -1;
      captionText.textContent = '';
      captionContainer.style.background = 'transparent';
      captionContainer.style.border = 'none';
      captionContainer.style.boxShadow = 'none';
      captionContainer.style.pointerEvents = 'none';
    }
  }
}

// --- HIGHLIGHT MODE: Show full sentence but highlight the active word ---
function updateHighlightCaption(currentTime) {
  const activeCaption = captionsData.find(c => currentTime >= c.startTime && currentTime <= c.endTime);

  if (activeCaption) {
    // Find which words in this segment are currently active
    const segmentWords = wordsData.filter(w => w.start >= activeCaption.startTime && w.end <= activeCaption.endTime);
    const activeWord = segmentWords.find(w => currentTime >= w.start && currentTime <= w.end);
    
    if (currentCaptionId !== activeCaption.id) {
      currentCaptionId = activeCaption.id;
      resetCaptionPosition();
      // Render all words as spans
      const words = segmentWords.length ? segmentWords : activeCaption.text.split(/\s+/).map((w, i) => ({ word: w, id: i }));
      captionText.innerHTML = words.map(w => 
        `<span class="word-highlight" data-word-id="${w.id}">${w.word}</span>`
      ).join(' ');

      // Apply box styling
      const opacity = settings.bgOpacity.value;
      const bgColor = settings.bgColor.value;
      captionContainer.style.backgroundColor = hexToRgba(bgColor, opacity);
      captionContainer.style.border = settings.boxBorder.value;
      captionContainer.style.boxShadow = settings.boxShadow.value;

      captionContainer.style.pointerEvents = 'auto';
      // Animation
      const anim = settings.animType.value;
      const speed = parseFloat(settings.animSpeed.value) || 1;
      const duration = (1 / speed);
      gsap.killTweensOf(captionContainer);
      if (anim === 'fade') {
        gsap.fromTo(captionContainer, { opacity: 0 }, { opacity: 1, duration: 0.3 * duration });
      } else if (anim === 'pop') {
        gsap.fromTo(captionContainer, { scale: 0.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5 * duration, ease: 'elastic.out(1, 0.7)' });
      } else {
        gsap.set(captionContainer, { opacity: 1, scale: 1 });
      }
      requestAnimationFrame(() => clampCaptionToOverlay());
    }

    // Update word highlights every frame
    const highlightColor = settings.highlightColor.value || '#fbbf24';
    const textColor = settings.textColor.value;
    const wordSpans = captionText.querySelectorAll('.word-highlight');
    
    wordSpans.forEach(span => {
      const wordId = parseInt(span.dataset.wordId);
      const matchWord = segmentWords.find(w => w.id === wordId);
      if (matchWord && currentTime >= matchWord.start) {
        span.style.color = highlightColor;
        span.classList.add('active');
      } else {
        span.style.color = textColor;
        span.classList.remove('active');
      }
    });
  } else {
    currentCaptionId = -1;
    captionText.textContent = '';
    captionContainer.style.background = 'transparent';
    captionContainer.style.border = 'none';
    captionContainer.style.boxShadow = 'none';
    captionContainer.style.pointerEvents = 'none';
  }
}

// Reset caption to CSS flex positioning (not manual left/top from dragging)
function resetCaptionPosition() {
  captionContainer.style.left = '';
  captionContainer.style.top = '';
  captionContainer.style.right = '';
  captionContainer.style.bottom = '';
  captionContainer.style.margin = '';
  captionContainer.style.transform = '';
  captionContainer.style.position = 'relative';
}

// Clamp caption container so it never overflows the overlay bounds
function clampCaptionToOverlay() {
  const overlayRect = captionOverlay.getBoundingClientRect();
  const capRect = captionContainer.getBoundingClientRect();

  // Check if it's overflowing and fix with absolute positioning if needed
  const capRight = capRect.left + capRect.width;
  const capBottom = capRect.top + capRect.height;
  const overlayRight = overlayRect.left + overlayRect.width;
  const overlayBottom = overlayRect.top + overlayRect.height;

  if (capRect.left < overlayRect.left || capRight > overlayRight ||
      capRect.top < overlayRect.top || capBottom > overlayBottom) {
    // Switch to absolute and constrain
    captionContainer.style.position = 'absolute';
    let x = capRect.left - overlayRect.left;
    let y = capRect.top - overlayRect.top;
    x = Math.max(0, Math.min(x, overlayRect.width - capRect.width));
    y = Math.max(0, Math.min(y, overlayRect.height - capRect.height));
    captionContainer.style.left = x + 'px';
    captionContainer.style.top = y + 'px';
  }
}

function displayCaption(text, captionObj) {
  const isWordHighlight = settings.wordHighlight.checked;

  if (isWordHighlight) {
    // Wrap each word in a span
    const words = text.split(/\s+/);
    captionText.innerHTML = words.map((word, i) => 
      `<span class="word-highlight" data-index="${i}">${word}</span>`
    ).join(' ');
  } else {
    captionText.textContent = text;
  }
  
  const anim = settings.animType.value;
  const container = captionContainer;
  const speed = parseFloat(settings.animSpeed.value) || 1;
  const duration = (1 / speed);

  // Kill any running animations
  gsap.killTweensOf(container);
  
  // Update background box
  const opacity = settings.bgOpacity.value;
  const bgColor = settings.bgColor.value;
  container.style.backgroundColor = hexToRgba(bgColor, opacity);

  // Apply box styling
  container.style.border = settings.boxBorder.value;
  container.style.boxShadow = settings.boxShadow.value;

  if (anim === 'none') {
    gsap.set(container, { opacity: 1, scale: 1, x: 0, y: 0, rotationX: 0, filter: 'blur(0px)' });
    return;
  }

  // --- GSAP Premium Transitions ---
  switch (anim) {
    case 'fade':
      gsap.fromTo(container, { opacity: 0 }, { opacity: 1, duration: 0.3 * duration });
      break;
    case 'pop':
      gsap.fromTo(container, 
        { scale: 0.5, opacity: 0 }, 
        { scale: 1, opacity: 1, duration: 0.5 * duration, ease: "elastic.out(1, 0.7)" }
      );
      break;
    case 'slide':
      gsap.fromTo(container, 
        { x: -50, opacity: 0 }, 
        { x: 0, opacity: 1, duration: 0.4 * duration, ease: "power2.out" }
      );
      break;
    case 'slideUp':
      gsap.fromTo(container, 
        { y: 30, opacity: 0 }, 
        { y: 0, opacity: 1, duration: 0.4 * duration, ease: "power2.out" }
      );
      break;
    case 'slideDown':
      gsap.fromTo(container, 
        { y: -30, opacity: 0 }, 
        { y: 0, opacity: 1, duration: 0.4 * duration, ease: "power2.out" }
      );
      break;
    case 'blur':
      gsap.fromTo(container, 
        { filter: 'blur(10px)', opacity: 0, scale: 0.9 }, 
        { filter: 'blur(0px)', opacity: 1, scale: 1, duration: 0.6 * duration, ease: "power3.out" }
      );
      break;
    case 'scale':
      gsap.fromTo(container, 
        { scale: 1.5, opacity: 0 }, 
        { scale: 1, opacity: 1, duration: 0.4 * duration, ease: "back.out(2)" }
      );
      break;
    case 'flip':
      gsap.fromTo(container, 
        { rotationX: -90, opacity: 0 }, 
        { rotationX: 0, opacity: 1, duration: 0.6 * duration, ease: "power2.out" }
      );
      break;
    case 'typewriter':
      gsap.fromTo(container, 
        { clipPath: 'inset(0 100% 0 0)' }, 
        { clipPath: 'inset(0 0% 0 0)', duration: 0.8 * duration, ease: "none" }
      );
      break;
    case 'bounce':
      gsap.fromTo(container, 
        { y: 40, opacity: 0 }, 
        { y: 0, opacity: 1, duration: 0.6 * duration, ease: "bounce.out" }
      );
      break;
    case 'glitch':
      gsap.set(container, { opacity: 1 });
      gsap.fromTo(container,
        { x: 0 },
        { 
          keyframes: [
            { x: -4, y: 2, duration: 0.05 * duration },
            { x: 4, y: -2, duration: 0.05 * duration },
            { x: -2, y: 1, duration: 0.05 * duration },
            { x: 3, y: -1, duration: 0.05 * duration },
            { x: 0, y: 0, duration: 0.05 * duration },
          ],
          ease: "none"
        }
      );
      break;
    case 'wave':
      // Animate each word with stagger
      const words = container.querySelectorAll('.word-highlight');
      if (words.length) {
        gsap.fromTo(words, 
          { y: 15, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.3 * duration, stagger: 0.06 * duration, ease: "back.out(2)" }
        );
      } else {
        gsap.fromTo(container, { opacity: 0 }, { opacity: 1, duration: 0.3 * duration });
      }
      break;
  }
}

function updateWordHighlight(caption, currentTime) {
  const words = captionText.querySelectorAll('.word-highlight');
  if (!words.length) return;

  const duration = caption.endTime - caption.startTime;
  const elapsed = currentTime - caption.startTime;
  const progress = elapsed / duration;
  
  const highlightColor = settings.highlightColor.value;
  const textColor = settings.textColor.value;
  
  const activeIndex = Math.floor(progress * words.length);

  words.forEach((word, i) => {
    if (i <= activeIndex) {
      word.style.color = highlightColor;
      word.classList.add('active');
    } else {
      word.style.color = textColor;
      word.classList.remove('active');
    }
  });
}

function applySettingsToPreview() {
  // Font
  let activeFontFamily = settings.fontFamily.value;
  if (settings.customFontName.value && settings.customFontName.dataset.active === 'true') {
    activeFontFamily = `'${settings.customFontName.value}', sans-serif`;
  }

  captionContainer.style.fontFamily = activeFontFamily;
  captionContainer.style.fontSize = settings.fontSize.value + 'px';
  captionContainer.style.fontWeight = settings.fontWeight.value;
  captionContainer.style.color = settings.textColor.value;

  // Text Transform & Font Style
  captionContainer.style.textTransform = currentTextTransform;
  captionContainer.style.fontStyle = currentFontStyle;

  // Letter Spacing & Line Height
  captionContainer.style.letterSpacing = settings.letterSpacing.value + 'px';
  captionContainer.style.lineHeight = settings.lineHeight.value;

  // Text Shadow
  captionContainer.style.textShadow = settings.textShadow.value;

  // Text Stroke
  const strokeWidth = settings.textStroke.value;
  const strokeColor = settings.strokeColor.value;
  if (strokeWidth !== '0') {
    captionContainer.style.webkitTextStroke = `${strokeWidth}px ${strokeColor}`;
  } else {
    captionContainer.style.webkitTextStroke = 'unset';
  }

  // Text Decoration
  captionText.style.textDecoration = settings.textDecoration.value;

  // Caption Box
  const borderRadius = settings.borderRadius.value;
  const padding = settings.captionPadding.value;
  captionContainer.style.borderRadius = borderRadius + 'px';
  captionContainer.style.padding = `${padding}px ${padding * 2}px`;
  captionContainer.style.maxWidth = settings.captionMaxWidth.value + '%';

  // Box border & shadow
  captionContainer.style.border = settings.boxBorder.value;
  captionContainer.style.boxShadow = settings.boxShadow.value;

  // Layout — position the overlay flex container
  captionOverlay.style.alignItems = settings.hPos.value === 'center' ? 'center' : 
                                   settings.hPos.value === 'left' ? 'flex-start' : 'flex-end';
  
  captionOverlay.style.justifyContent = settings.vPos.value === 'center' ? 'center' : 
                                       settings.vPos.value === 'top' ? 'flex-start' : 'flex-end';

  captionText.style.textAlign = settings.hPos.value;

  // Re-clamp after settings change
  requestAnimationFrame(() => clampCaptionToOverlay());
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function loadCustomFont() {
  const fontName = settings.customFontName.value.trim();
  if (!fontName) return;

  const linkId = 'dynamic-font-' + fontName.replace(/\s+/g, '-').toLowerCase();
  if (!document.getElementById(linkId)) {
    const link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(/\s+/g, '+')}&display=swap`;
    document.head.appendChild(link);
    
    link.onload = () => {
      settings.customFontName.dataset.active = 'true';
      applySettingsToPreview();
      notyf.success(`Font "${fontName}" loaded!`);
    };
    link.onerror = () => {
      notyf.error(`Could not load font "${fontName}". Check fonts.google.com for the exact name.`);
    };
  } else {
    settings.customFontName.dataset.active = 'true';
    applySettingsToPreview();
  }
}

async function startBurnInExport() {
  const video = mainVideo;

  // 1. Create a high-res canvas at video resolution
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;

  // Snapshot the current caption position relative to overlay for export
  const exportLayout = snapshotCaptionLayout(canvas);

  notyf.info("Recording frames... please wait.");
  processingStatus.style.display = 'block';
  updateProgress(5, "Preparing export...");
  
  const stream = canvas.captureStream(30);
  
  // Try VP9 first, fallback to VP8
  let mimeType = 'video/webm;codecs=vp9';
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = 'video/webm;codecs=vp8';
  }

  const recorder = new MediaRecorder(stream, { 
    mimeType,
    videoBitsPerSecond: 8000000
  });
  
  const chunks = [];
  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
  
  recorder.onstop = async () => {
    const webmBlob = new Blob(chunks, { type: 'video/webm' });
    updateProgress(70, "Converting to MP4 with FFmpeg...");
    
    try {
      const mp4Blob = await convertWebmToMp4(webmBlob);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(mp4Blob);
      a.download = 'captioned-video.mp4';
      a.click();
      notyf.success("Export Complete! MP4 video saved.");
    } catch (err) {
      console.error('MP4 conversion failed, downloading WebM instead:', err);
      // Fallback: download the webm directly
      const a = document.createElement('a');
      a.href = URL.createObjectURL(webmBlob);
      a.download = 'captioned-video.webm';
      a.click();
      notyf.warn("MP4 conversion failed — saved as WebM instead.");
    }
    
    generateBtn.disabled = false;
    settings.exportBtn.disabled = false;
    video.playbackRate = 1.0;
    video.muted = false;
    processingStatus.style.display = 'none';
  };

  // 2. Playback at normal speed, muted so user doesn't hear echo/desync during recording
  video.currentTime = 0;
  video.muted = true;
  video.pause();
  
  recorder.start(100); // Collect data every 100ms
  generateBtn.disabled = true;
  settings.exportBtn.disabled = true;

  let frameCount = 0;
  const totalFrames = (video.duration || 30) * 30; // estimate

  const drawFrame = () => {
    if (video.ended) {
      recorder.stop();
      return;
    }
    if (video.paused && !video.ended) {
      // Wait for play
      requestAnimationFrame(drawFrame);
      return;
    }

    // Draw video frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Draw caption if active
    const currentTime = video.currentTime;
    const active = captionsData.find(c => currentTime >= c.startTime && currentTime <= c.endTime);

    if (active) {
      drawCanvasCaption(ctx, canvas, active.text, exportLayout);
    }

    frameCount++;
    const pct = Math.min(65, Math.round((frameCount / totalFrames) * 65) + 5);
    updateProgress(pct, `Recording frame ${frameCount}...`);

    requestAnimationFrame(drawFrame);
  };

  // Start playback
  await video.play();
  drawFrame();
}

// Snapshot the current caption layout position for export
function snapshotCaptionLayout(canvas) {
  const overlayRect = captionOverlay.getBoundingClientRect();
  const capRect = captionContainer.getBoundingClientRect();
  const scale = canvas.width / (overlayRect.width || 1);
  
  // Compute caption center position relative to overlay
  const relCenterX = (capRect.left - overlayRect.left + capRect.width / 2) / overlayRect.width;
  const relCenterY = (capRect.top - overlayRect.top + capRect.height / 2) / overlayRect.height;

  // Vertical and horizontal alignment settings
  const vPos = settings.vPos.value;
  const hPos = settings.hPos.value;

  return { relCenterX, relCenterY, scale, vPos, hPos };
}

async function convertWebmToMp4(webmBlob) {
  const ff = await getFFmpeg();
  
  const inputData = new Uint8Array(await webmBlob.arrayBuffer());
  await ff.writeFile('input.webm', inputData);
  
  // Get original audio
  // Check if currentVideoFile exists, it shouldn't be null but just in case
  if (currentVideoFile) {
    await ff.writeFile('original.mp4', await fetchFile(currentVideoFile));
  } else {
    // If somehow missing, just make an empty placeholder
    await ff.writeFile('original.mp4', new Uint8Array());
  }
  
  // Convert webm to mp4, mapping canvas video and original audio
  await ff.exec([
    '-i', 'input.webm',
    '-i', 'original.mp4',
    '-map', '0:v:0',    // Take video stream exclusively from the recorded WebM canvas
    '-map', '1:a:0?',   // Take audio stream exclusively from the original file (the ? makes it optional)
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-strict', 'experimental',
    '-movflags', '+faststart',
    '-shortest',        // Cut off if one stream is slightly longer than the other
    'output.mp4'
  ]);
  
  const mp4Data = await ff.readFile('output.mp4');
  
  // Cleanup
  await ff.deleteFile('input.webm');
  await ff.deleteFile('original.mp4');
  await ff.deleteFile('output.mp4');
  
  return new Blob([mp4Data.buffer], { type: 'video/mp4' });
}

function drawCanvasCaption(ctx, canvas, text, layout) {
  const scale = canvas.width / (mainVideo.clientWidth || 1);
  const fontSize = parseInt(settings.fontSize.value) * scale;
  const padding = parseInt(settings.captionPadding.value) * scale;
  const fontStyle = currentFontStyle === 'italic' ? 'italic ' : '';
  
  // Clean font name for canvas (remove quotes)
  const fontName = settings.fontFamily.value.replace(/'/g, '');
  ctx.font = `${fontStyle}${settings.fontWeight.value} ${fontSize}px ${fontName}`;
  ctx.textBaseline = 'middle';

  // Apply text transform
  if (currentTextTransform === 'uppercase') text = text.toUpperCase();
  else if (currentTextTransform === 'lowercase') text = text.toLowerCase();
  else if (currentTextTransform === 'capitalize') text = text.replace(/\b\w/g, c => c.toUpperCase());

  // Word-wrap long text to fit within maxWidth
  const maxTextWidth = (parseFloat(settings.captionMaxWidth.value) / 100) * canvas.width - padding * 4;
  const lines = wrapText(ctx, text, maxTextWidth);
  
  const lineHeight = parseFloat(settings.lineHeight.value);
  const textBlockWidth = Math.max(...lines.map(l => ctx.measureText(l).width));
  const textBlockHeight = lines.length * fontSize * lineHeight;

  // Compute box dimensions
  const boxW = textBlockWidth + padding * 4;
  const boxH = textBlockHeight + padding * 2;

  // Compute position based on alignment settings, clamped to canvas
  let x, y;
  const hPos = settings.hPos.value;
  const vPos = settings.vPos.value;
  const margin = 20 * scale; // Safe margin from edges

  // Horizontal
  if (hPos === 'left') {
    x = margin;
  } else if (hPos === 'right') {
    x = canvas.width - boxW - margin;
  } else {
    x = (canvas.width - boxW) / 2;
  }

  // Vertical
  if (vPos === 'top') {
    y = margin;
  } else if (vPos === 'center') {
    y = (canvas.height - boxH) / 2;
  } else {
    // Bottom — standard subtitle position
    y = canvas.height - boxH - margin;
  }

  // Clamp within canvas bounds
  x = Math.max(0, Math.min(x, canvas.width - boxW));
  y = Math.max(0, Math.min(y, canvas.height - boxH));

  // Draw background box
  const opacity = settings.bgOpacity.value;
  const bgColor = settings.bgColor.value;
  ctx.fillStyle = hexToRgba(bgColor, opacity);
  
  const borderRadius = Math.min(parseInt(settings.borderRadius.value) * scale, boxH / 2);
  ctx.beginPath();
  ctx.roundRect(x, y, boxW, boxH, borderRadius);
  ctx.fill();

  // Text drawing position
  ctx.textAlign = 'center';
  const textCenterX = x + boxW / 2;
  const textStartY = y + padding + fontSize * lineHeight / 2;

  // Text stroke
  const strokeWidth = parseInt(settings.textStroke.value);
  if (strokeWidth > 0) {
    ctx.strokeStyle = settings.strokeColor.value;
    ctx.lineWidth = strokeWidth * scale;
    ctx.lineJoin = 'round';
    lines.forEach((line, i) => {
      ctx.strokeText(line, textCenterX, textStartY + i * fontSize * lineHeight);
    });
  }

  // Fill text and handle text-decoration
  ctx.fillStyle = settings.textColor.value;
  const dec = settings.textDecoration.value;
  
  lines.forEach((line, i) => {
    const lineY = textStartY + i * fontSize * lineHeight;
    ctx.fillText(line, textCenterX, lineY);
    
    // Draw text decoration manually on canvas
    if (dec && dec !== 'none') {
      const metrics = ctx.measureText(line);
      const decY = dec.includes('underline') ? lineY + fontSize * 0.4 : 
                   dec.includes('overline') ? lineY - fontSize * 0.5 : lineY;
                   
      ctx.beginPath();
      ctx.strokeStyle = settings.textColor.value;
      ctx.lineWidth = Math.max(1, fontSize * 0.08); // scale line width
      
      // Basic wavy implementation support (rendering as a line for simplicity on canvas)
      ctx.moveTo(textCenterX - metrics.width/2, decY);
      ctx.lineTo(textCenterX + metrics.width/2, decY);
      ctx.stroke();
    }
  });
}

// Word-wrap text for canvas rendering
function wrapText(ctx, text, maxWidth) {
  if (maxWidth <= 0) return [text];
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? (currentLine + ' ' + word) : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines.length ? lines : [text];
}

function downloadSRT() {
  let srt = "";
  captionsData.forEach((c, i) => {
    srt += `${i + 1}\n`;
    srt += `${c.start.replace('.', ',')} --> ${c.end.replace('.', ',')}\n`;
    srt += `${c.text}\n\n`;
  });

  const blob = new Blob([srt], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "captions.srt";
  a.click();
  notyf.success("SRT file downloaded!");
}

async function startVideoRecording() {
  const stream = document.querySelector('.video-surface').captureStream ? 
                 document.querySelector('.video-surface').captureStream() : 
                 null;
  
  if (!stream) {
    notyf.error("Browser doesn't support container capture. Exporting SRT instead.");
    downloadSRT();
    return;
  }

  const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
  const chunks = [];
  
  recorder.ondataavailable = e => chunks.push(e.data);
  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'captured-video.webm';
    a.click();
    notyf.success("Video exported!");
  };

  mainVideo.currentTime = 0;
  mainVideo.play();
  recorder.start();
  notyf.info("Recording video... please wait.");

  mainVideo.onended = () => {
    recorder.stop();
  };
}


function syncOverlaySize() {
  if (!mainVideo.videoWidth || !mainVideo.videoHeight) return;

  const surface = document.querySelector('.video-surface');
  const aspectRatio = mainVideo.videoWidth / mainVideo.videoHeight;

  // Let the video fill the surface width and compute height from aspect ratio
  const surfaceWidth = surface.clientWidth;
  const computedHeight = surfaceWidth / aspectRatio;

  // Clamp height to a reasonable max
  const maxHeight = window.innerHeight * 0.75;
  const finalHeight = Math.min(computedHeight, maxHeight);
  const finalWidth = finalHeight * aspectRatio;

  // Apply to the surface container — match both width and height to the video
  surface.style.width = finalWidth + 'px';
  surface.style.minHeight = finalHeight + 'px';
  surface.style.height = finalHeight + 'px';

  // Size the video element to fill properly
  mainVideo.style.width = finalWidth + 'px';
  mainVideo.style.height = finalHeight + 'px';
  mainVideo.style.objectFit = 'contain';

  // Position overlay exactly over the rendered video area
  // The video is centered inside the surface via flexbox
  const surfaceRect = surface.getBoundingClientRect();
  const videoRect = mainVideo.getBoundingClientRect();

  captionOverlay.style.width = videoRect.width + 'px';
  captionOverlay.style.height = videoRect.height + 'px';
  captionOverlay.style.left = (videoRect.left - surfaceRect.left) + 'px';
  captionOverlay.style.top = (videoRect.top - surfaceRect.top) + 'px';
}

// Start app
init();
