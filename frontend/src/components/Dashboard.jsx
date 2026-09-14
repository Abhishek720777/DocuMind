import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { ragApi } from '../api';
import '../styles/Dashboard.css';

function Dashboard() {
  const [user, setUser] = useState(null);
  const [file, setFile] = useState(null);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await api.get('/me/');
        setUser(response.data.username);
      } catch (err) {
        navigate('/login');
      }
    };
    fetchUser();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await api.post('/logout/');
      navigate('/login');
    } catch (err) {
      console.error('Logout failed');
    }
  };

  const handleIngest = async (e) => {
    e.preventDefault();
    if (!file && !url) {
      setMessage('Please provide a file or a URL');
      return;
    }
    
    setLoading(true);
    setMessage('');
    
    const formData = new FormData();
    if (file) formData.append('file', file);
    if (url) formData.append('url', url);

    try {
      const response = await ragApi.post('/ingest', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setMessage(`Success! Ingested ${response.data.chunks_processed} chunks from ${response.data.source}`);
      setFile(null);
      setUrl('');
    } catch (err) {
      setMessage(err.response?.data?.detail || 'Ingestion failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-container">
      <nav className="navbar">
        <h2>DocuMind</h2>
        <div className="nav-right">
          <span>Welcome, {user}</span>
          <button onClick={() => navigate('/chat')} className="btn chat-nav-btn">Go to Chat</button>
          <button onClick={handleLogout} className="btn outline-btn">Logout</button>
        </div>
      </nav>

      <main className="dashboard-main">
        <div className="glass-card upload-card">
          <h3>Ingest Knowledge</h3>
          <p className="subtitle">Upload a document (PDF/TXT) or provide a URL to add to your knowledge base.</p>
          
          {message && (
            <div className={`status-message ${message.startsWith('Success') ? 'success' : 'error'}`}>
              {message}
            </div>
          )}
          
          <form onSubmit={handleIngest} className="ingest-form">
            <div className="form-group">
              <label>Upload File</label>
              <div className="file-drop-area">
                <input 
                  type="file" 
                  accept=".pdf,.txt"
                  onChange={(e) => { setFile(e.target.files[0]); setUrl(''); }}
                  disabled={loading || url !== ''}
                  className="file-input"
                />
                <div className="file-msg">
                  {file ? file.name : 'Choose a file or drag it here'}
                </div>
              </div>
            </div>
            
            <div className="divider"><span>OR</span></div>
            
            <div className="form-group">
              <label>Scrape URL</label>
              <input
                type="url"
                className="input-field"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => { setUrl(e.target.value); setFile(null); }}
                disabled={loading || file !== null}
              />
            </div>
            
            <button type="submit" className="btn ingest-btn" disabled={loading || (!file && !url)}>
              {loading ? 'Processing...' : 'Ingest Document'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

export default Dashboard;
