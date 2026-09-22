import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api, { ragApi } from '../api';
import '../styles/Dashboard.css';

function Dashboard() {
  const [user, setUser] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [activeTab, setActiveTab] = useState('file'); // 'file' | 'url'
  const [file, setFile] = useState(null);
  const [url, setUrl] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [dragOver, setDragOver] = useState(false);
  const navigate = useNavigate();

  const fetchDocuments = async () => {
    try {
      const response = await api.get('documents/');
      setDocuments(response.data);
    } catch (err) {
      console.error('Failed to fetch documents');
    }
  };

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await api.get('me/');
        setUser(response.data);
        fetchDocuments();
      } catch (err) {
        navigate('/login');
      }
    };
    fetchUser();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await api.post('logout/');
      navigate('/login');
    } catch (err) {
      console.error('Logout failed');
    }
  };

  const handleIngest = async (e) => {
    e.preventDefault();
    if (activeTab === 'file' && !file) {
      setMessage({ text: 'Please select a PDF or TXT file to index.', type: 'error' });
      return;
    }
    if (activeTab === 'url' && !url.trim()) {
      setMessage({ text: 'Please enter a valid website URL.', type: 'error' });
      return;
    }
    if (!user) return;
    
    setLoading(true);
    setMessage({ text: '', type: '' });
    
    const formData = new FormData();
    if (activeTab === 'file' && file) formData.append('file', file);
    if (activeTab === 'url' && url) formData.append('url', url.trim());

    try {
      const response = await ragApi.post('ingest', formData);

      // Save document record to Django
      await api.post('documents/', { source: response.data.source });

      setMessage({
        text: `Indexed ${response.data.chunks_processed} passages from "${response.data.source}".`,
        type: 'success'
      });
      setFile(null);
      setUrl('');
      fetchDocuments();
    } catch (err) {
      setMessage({
        text: err.response?.data?.detail || 'Document ingestion failed. Please verify the source.',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.endsWith('.pdf') || droppedFile.name.endsWith('.txt')) {
        setFile(droppedFile);
        setActiveTab('file');
      } else {
        setMessage({ text: 'Please provide PDF or TXT documents.', type: 'error' });
      }
    }
  };

  const filteredDocs = useMemo(() => {
    if (!searchTerm.trim()) return documents;
    return documents.filter(doc => 
      doc.source.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [documents, searchTerm]);

  const getDocMeta = (source) => {
    if (source.startsWith('http://') || source.startsWith('https://')) {
      return { type: 'URL', label: 'Web Page', icon: '🌐' };
    }
    if (source.toLowerCase().endsWith('.pdf')) {
      return { type: 'PDF', label: 'PDF Document', icon: '📄' };
    }
    return { type: 'TXT', label: 'Text Document', icon: '📝' };
  };

  return (
    <div className="dm-dash-root">
      <div className="dm-grain" aria-hidden="true" />

      {/* Top Bar */}
      <nav className="dm-dash-nav">
        <div className="dm-dash-nav-left">
          <Link to="/" className="dm-dash-brand">
            <svg viewBox="0 0 28 28" className="dm-brand-mark" aria-hidden="true">
              <rect x="5" y="3" width="15" height="20" rx="2.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <rect x="9" y="7" width="15" height="20" rx="2.4" fill="var(--paper-card)" stroke="currentColor" strokeWidth="1.6" />
              <circle cx="19.2" cy="12.4" r="1.4" fill="var(--brass)" />
            </svg>
            <span className="dm-dash-brand-title">DocuMind</span>
          </Link>
          <span className="dm-dash-nav-divider">/</span>
          <span className="dm-dash-tagline">Knowledge Studio</span>
        </div>

        <div className="dm-dash-nav-actions">
          <div className="dm-user-tag">
            <span className="dm-user-dot" />
            <span>{user?.username}</span>
          </div>

          <button onClick={() => navigate('/chat')} className="dm-btn dm-btn--primary dm-btn--sm">
            <span>Open Chat</span>
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 8h10M9 4l4 4-4 4" />
            </svg>
          </button>

          <button onClick={handleLogout} className="dm-btn dm-btn--ghost dm-btn--sm" title="Sign out">
            Sign out
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="dm-dash-main">
        {/* Header summary */}
        <header className="dm-dash-header">
          <div className="dm-dash-intro">
            <span className="dm-section-eyebrow">Workspace</span>
            <h1 className="dm-dash-h1">Your reading shelf</h1>
            <p className="dm-dash-desc">
              Feed in documents or web articles. DocuMind indexes passages into searchable memory so you can query them anytime with verifiable citations.
            </p>
          </div>

          <div className="dm-dash-summary-pill">
            <div className="dm-summary-stat">
              <span className="dm-stat-num">{documents.length}</span>
              <span className="dm-stat-label">Sources Indexed</span>
            </div>
            <div className="dm-summary-divider" />
            <button onClick={() => navigate('/chat')} className="dm-chat-all-link">
              Start querying all →
            </button>
          </div>
        </header>

        {/* Studio Section */}
        <div className="dm-dash-layout">
          {/* Ingestion Console */}
          <section className="dm-dash-card dm-ingest-card">
            <div className="dm-card-head">
              <div className="dm-card-head-info">
                <h2>Add new source</h2>
                <p>Add a file or paste a link to expand your knowledge base.</p>
              </div>
            </div>

            {/* Mode Selector */}
            <div className="dm-mode-switch">
              <button 
                type="button" 
                className={`dm-mode-btn ${activeTab === 'file' ? 'active' : ''}`}
                onClick={() => { setActiveTab('file'); setUrl(''); setMessage({ text: '', type: '' }); }}
              >
                <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.4">
                  <path d="M3 2.5h7l3 3V13.5a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1z" />
                  <polyline points="10 2.5 10 5.5 13 5.5" />
                </svg>
                <span>Upload File</span>
              </button>

              <button 
                type="button" 
                className={`dm-mode-btn ${activeTab === 'url' ? 'active' : ''}`}
                onClick={() => { setActiveTab('url'); setFile(null); setMessage({ text: '', type: '' }); }}
              >
                <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.4">
                  <circle cx="8" cy="8" r="6" />
                  <line x1="2" y1="8" x2="14" y2="8" />
                  <path d="M8 2a9 9 0 0 1 3 6 9 9 0 0 1-3 6 9 9 0 0 1-3-6 9 9 0 0 1 3-6z" />
                </svg>
                <span>Web URL</span>
              </button>
            </div>

            {/* Status alerts */}
            {message.text && (
              <div className={`dm-status-msg ${message.type}`}>
                <span className="dm-status-icon">{message.type === 'success' ? '✓' : '•'}</span>
                <span>{message.text}</span>
              </div>
            )}

            <form onSubmit={handleIngest} className="dm-ingest-form">
              {activeTab === 'file' ? (
                <div 
                  className={`dm-drop-box ${dragOver ? 'dm-drop-box--drag' : ''} ${file ? 'dm-drop-box--loaded' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleFileDrop}
                >
                  <input 
                    type="file" 
                    id="dm-file-input"
                    accept=".pdf,.txt"
                    onChange={(e) => setFile(e.target.files[0] || null)}
                    disabled={loading}
                    className="dm-hidden-input"
                  />
                  <label htmlFor="dm-file-input" className="dm-drop-label">
                    <div className="dm-drop-icon">
                      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M12 16v-8m-4 4 4-4 4 4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
                      </svg>
                    </div>
                    {file ? (
                      <div className="dm-file-info">
                        <span className="dm-file-name">{file.name}</span>
                        <span className="dm-file-size">{(file.size / 1024).toFixed(1)} KB · PDF/TXT Document</span>
                      </div>
                    ) : (
                      <div className="dm-drop-prompt">
                        <span className="dm-drop-main-text">Drop your PDF or TXT here</span>
                        <span className="dm-drop-sub-text">or click to browse your files</span>
                      </div>
                    )}
                  </label>
                </div>
              ) : (
                <div className="dm-url-group">
                  <label htmlFor="dm-url-input" className="dm-field-label">Target Web Page URL</label>
                  <div className="dm-url-input-wrap">
                    <input
                      id="dm-url-input"
                      type="url"
                      placeholder="https://docs.example.com/handbook"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      disabled={loading}
                      required
                    />
                  </div>
                  <span className="dm-field-hint">DocuMind extracts the core article text, stripping banners and menus.</span>
                </div>
              )}

              <button 
                type="submit" 
                className="dm-btn dm-btn--primary dm-btn--block"
                disabled={loading || (activeTab === 'file' ? !file : !url.trim())}
              >
                {loading ? (
                  <span className="dm-loading-wrap">
                    <span className="dm-spinner" />
                    <span>Indexing passages...</span>
                  </span>
                ) : (
                  <span>Index Document</span>
                )}
              </button>
            </form>
          </section>

          {/* Sources Shelf */}
          <section className="dm-dash-card dm-shelf-card">
            <div className="dm-card-head dm-card-head--split">
              <div className="dm-card-head-info">
                <h2>Indexed Sources</h2>
                <p>Click any document to start a focused conversation.</p>
              </div>

              {documents.length > 0 && (
                <div className="dm-search-wrap">
                  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" className="dm-search-icon">
                    <circle cx="7" cy="7" r="5" />
                    <line x1="11" y1="11" x2="14" y2="14" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Filter sources..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="dm-search-input"
                  />
                  {searchTerm && (
                    <button onClick={() => setSearchTerm('')} className="dm-search-clear">×</button>
                  )}
                </div>
              )}
            </div>

            <div className="dm-shelf-body">
              {documents.length === 0 ? (
                <div className="dm-empty-shelf">
                  <div className="dm-empty-mark">
                    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.4">
                      <rect x="4" y="3" width="16" height="18" rx="2" />
                      <line x1="8" y1="8" x2="16" y2="8" />
                      <line x1="8" y1="12" x2="14" y2="12" />
                    </svg>
                  </div>
                  <h3>Your shelf is empty</h3>
                  <p>Upload a document or provide an article link on the left to begin.</p>
                </div>
              ) : filteredDocs.length === 0 ? (
                <div className="dm-empty-shelf">
                  <p>No sources found matching "{searchTerm}".</p>
                </div>
              ) : (
                <div className="dm-doc-rows">
                  {filteredDocs.map(doc => {
                    const meta = getDocMeta(doc.source);
                    return (
                      <div key={doc.id} className="dm-doc-row">
                        <div className="dm-doc-row-main">
                          <span className={`dm-doc-type-badge ${meta.type.toLowerCase()}`}>
                            {meta.type}
                          </span>
                          <div className="dm-doc-details">
                            <span className="dm-doc-name" title={doc.source}>{doc.source}</span>
                            <span className="dm-doc-meta-sub">{meta.label} · Ready for querying</span>
                          </div>
                        </div>

                        <div className="dm-doc-row-actions">
                          <button
                            onClick={() => navigate(`/chat?source=${encodeURIComponent(doc.source)}`)}
                            className="dm-btn dm-btn--ghost dm-btn--sm"
                          >
                            <span>Chat</span>
                            <span className="dm-arrow-icon">→</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

export default Dashboard;
