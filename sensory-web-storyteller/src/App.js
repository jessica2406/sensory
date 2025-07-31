import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  // --- STATE MANAGEMENT ---
  // Content and Loading State
  const [url, setUrl] = useState('');
  const [content, setContent] = useState('Enter a URL above to load an article.');
  const [originalContent, setOriginalContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSimplifying, setIsSimplifying] = useState(false);

  // Accessibility and Feature State
  const [activeFontClass, setActiveFontClass] = useState('');
  const [simplificationMode, setSimplificationMode] = useState('detailed_summary');
  const [theme, setTheme] = useState('light'); // 'light', 'dark', or 'sepia'
  const [fontSize, setFontSize] = useState('medium'); // 'small', 'medium', or 'large'
  
  // TTS State
  const [ttsRate, setTtsRate] = useState(1);
  const [ttsPitch, setTtsPitch] = useState(1);
  const [ttsVoice, setTtsVoice] = useState(null);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [utterance, setUtterance] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);


  // --- SIDE EFFECTS ---
  // Effect to load available TTS voices from the browser
  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        setAvailableVoices(voices);
        if (!ttsVoice) {
          const defaultVoice = voices.find(v => v.lang.includes('en')) || voices[0];
          setTtsVoice(defaultVoice);
        }
      }
    };
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    loadVoices();
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
    };
  }, [ttsVoice]);

  // Effects for live TTS updates
  useEffect(() => { if (utterance) utterance.rate = ttsRate; }, [ttsRate, utterance]);
  useEffect(() => { if (utterance) utterance.pitch = ttsPitch; }, [ttsPitch, utterance]);
  useEffect(() => { handleStop(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ttsVoice]);

  useEffect(() => {
  // Get a reference to the body element
  const body = document.body;
  
  // Remove any existing theme classes
  body.classList.remove('theme-light', 'theme-dark', 'theme-sepia');
  
  // Add the new theme class
  body.classList.add(`theme-${theme}`);

}, [theme]);


  // --- HANDLER FUNCTIONS ---
  const handleFetchContent = async () => {
    handleStop();
    setIsLoading(true);
    setContent('Loading content...');
    setOriginalContent('');
    try {
      const response = await fetch('http://localhost:5000/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await response.json();
      if (data.extracted_text) {
        setContent(data.extracted_text);
        setOriginalContent(data.extracted_text);
      } else {
        setContent(`Error: ${data.error}`);
      }
    } catch (error) {
      setContent(`Failed to connect to the backend: ${error.message}`);
    }
    setIsLoading(false);
  };

  const handleSimplify = async () => {
    handleStop();
    if (content !== originalContent) {
      setContent(originalContent);
      return;
    }
    setIsSimplifying(true);
    try {
      const response = await fetch('http://localhost:5000/simplify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: content, mode: simplificationMode }),
      });
      const data = await response.json();
      if (data.simplified_text) {
        setContent(data.simplified_text);
      } else {
        console.error("Simplification failed:", data.error);
      }
    } catch (error) {
      console.error("Failed to connect to simplification endpoint:", error);
    }
    setIsSimplifying(false);
  };

  const handleTogglePlay = () => {
    if (isPlaying) {
      window.speechSynthesis.pause();
      setIsPlaying(false);
    } else {
      if (utterance && window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        setIsPlaying(true);
      } else {
        const newUtterance = new SpeechSynthesisUtterance(content);
        if (ttsVoice) newUtterance.voice = ttsVoice;
        newUtterance.pitch = ttsPitch;
        newUtterance.rate = ttsRate;
        
        newUtterance.onstart = () => setIsPlaying(true);
        newUtterance.onpause = () => setIsPlaying(false);
        newUtterance.onresume = () => setIsPlaying(true);
        newUtterance.onend = () => {
          setIsPlaying(false);
          setUtterance(null);
        };
        
        setUtterance(newUtterance);
        window.speechSynthesis.speak(newUtterance);
      }
    }
  };

  const handleStop = () => {
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setUtterance(null);
  };


  // --- JSX RENDER ---
  return (
    // The main div now includes classes for theme and font size
    <div className={`App font-size-${fontSize} ${activeFontClass}`}>
      <header className="App-header">
        <h1>Sensory Web Storyteller</h1>
        <div className="input-bar">
          <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Enter article URL" disabled={isLoading} />
          <button onClick={handleFetchContent} disabled={isLoading}>
            {isLoading ? 'Loading...' : 'Load Content'}
          </button>
        </div>
        
        {/* Container for all display settings */}
        <div className="display-settings-container">
          <div className="display-settings">
            <label htmlFor="font-select">Dyslexia-Friendly Font:</label>
            <select id="font-select" value={activeFontClass} onChange={(e) => setActiveFontClass(e.target.value)}>
              <option value="">Default</option>
              <option value="font-open-dyslexic">OpenDyslexic</option>
              <option value="font-open-dyslexic-alta">OpenDyslexic Alta</option>
              <option value="font-open-dyslexic-mono">OpenDyslexic Mono</option>
            </select>
          </div>

          {/* New visual controls are now included */}
          <div className="visual-controls">
            <div className="control-group">
              <span className="control-label">Theme:</span>
              <button onClick={() => setTheme('light')} className={theme === 'light' ? 'active' : ''}>Light</button>
              <button onClick={() => setTheme('dark')} className={theme === 'dark' ? 'active' : ''}>Dark</button>
              <button onClick={() => setTheme('sepia')} className={theme === 'sepia' ? 'active' : ''}>Sepia</button>
            </div>
            <div className="control-group">
              <span className="control-label">Text Size:</span>
              <button onClick={() => setFontSize('small')} className={fontSize === 'small' ? 'active' : ''}>A-</button>
              <button onClick={() => setFontSize('medium')} className={fontSize === 'medium' ? 'active' : ''}>A</button>
              <button onClick={() => setFontSize('large')} className={fontSize === 'large' ? 'active' : ''}>A+</button>
            </div>
          </div>
        </div>
      </header>

      <div className="controls-container">
        <div className="narration-controls">
          <button onClick={handleTogglePlay} disabled={!originalContent || isLoading}>
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <button onClick={handleStop} disabled={!isPlaying && !window.speechSynthesis.paused}>
            Stop
          </button>
        </div>

        {availableVoices.length > 0 && (
          <div className="tts-settings">
            <div className="tts-control">
              <label htmlFor="voice-select">Voice</label>
              <select id="voice-select" value={ttsVoice ? ttsVoice.name : ''} onChange={(e) => setTtsVoice(availableVoices.find(v => v.name === e.target.value))}>
                {availableVoices.map((voice) => (<option key={voice.name} value={voice.name}>{voice.name} ({voice.lang})</option>))}
              </select>
            </div>
            <div className="tts-control">
              <label htmlFor="rate-slider">Speed: {ttsRate}</label>
              <input type="range" id="rate-slider" min="0.5" max="2" step="0.1" value={ttsRate} onChange={(e) => setTtsRate(parseFloat(e.target.value))} />
            </div>
            <div className="tts-control">
              <label htmlFor="pitch-slider">Pitch: {ttsPitch}</label>
              <input type="range" id="pitch-slider" min="0" max="2" step="0.1" value={ttsPitch} onChange={(e) => setTtsPitch(parseFloat(e.target.value))} />
            </div>
          </div>
        )}

        {originalContent && (
          <div className="generation-controls">
            <fieldset className="mode-selector">
              <legend>Generation Mode</legend>
              <label><input type="radio" value="simplify" name="mode" checked={simplificationMode === 'simplify'} onChange={(e) => setSimplificationMode(e.target.value)} /> Simple</label>
              <label><input type="radio" value="detailed_summary" name="mode" checked={simplificationMode === 'detailed_summary'} onChange={(e) => setSimplificationMode(e.target.value)} /> Detailed</label>
              <label><input type="radio" value="teaching_mode" name="mode" checked={simplificationMode === 'teaching_mode'} onChange={(e) => setSimplificationMode(e.target.value)} /> Teaching</label>
            </fieldset>
            <button className="generate-button" onClick={handleSimplify} disabled={isSimplifying}>
              {isSimplifying ? 'Generating...' : (content !== originalContent ? 'Show Original Text' : 'Generate')}
            </button>
          </div>
        )}
      </div>

      <main className="content-viewer">
        <p>{content}</p>
      </main>
    </div>
  );
}

export default App;