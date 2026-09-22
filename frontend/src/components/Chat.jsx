import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import api, { ragApi } from '../api';
import '../styles/Chat.css';

function Chat() {
  const [searchParams] = useSearchParams();
  const sourceParam = searchParams.get('source');
  
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await api.get('me/');
        setUser(response.data);
        setMessages([{
          role: 'assistant',
          content: sourceParam 
            ? `I am ready. Ask me any question specifically about "${sourceParam}".` 
            : 'I am ready. Ask me anything about any of the documents or pages you have indexed.',
          citations: []
        }]);
      } catch (err) {
        navigate('/login');
      }
    };
    fetchUser();
  }, [navigate, sourceParam]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || !user || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const payload = { 
        question: userMessage, 
        top_k: 3
      };
      if (sourceParam) {
        payload.source = sourceParam;
      }
      
      const response = await ragApi.post('query', payload);
      
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: response.data.answer,
        citations: response.data.citations
      }]);
    } catch (err) {
      setMessages(prev => [...prev, { 
        role: 'error', 
        content: err.response?.data?.detail || 'An error occurred while generating the answer from your knowledge base.' 
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.post('logout/');
      navigate('/login');
    } catch (err) {
      console.error('Logout failed');
    }
  };

  return (
    <div className="dm-chat-layout">
      {/* Left Sidebar */}
      <aside className="dm-chat-sidebar">
        <div className="dm-chat-sidebar-top">
          <Link to="/" className="dm-chat-brand">
            <svg viewBox="0 0 28 28" className="dm-brand-mark" aria-hidden="true">
              <rect x="5" y="3" width="15" height="20" rx="2.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <rect x="9" y="7" width="15" height="20" rx="2.4" fill="var(--paper-card)" stroke="currentColor" strokeWidth="1.6" />
              <circle cx="19.2" cy="12.4" r="1.4" fill="var(--brass)" />
            </svg>
            <span className="dm-chat-brand-title">DocuMind</span>
          </Link>

          <nav className="dm-chat-nav-menu">
            <button onClick={() => navigate('/dashboard')} className="dm-nav-item">
              <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.4">
                <rect x="2" y="2" width="5" height="5" rx="1" />
                <rect x="9" y="2" width="5" height="5" rx="1" />
                <rect x="2" y="9" width="5" height="5" rx="1" />
                <rect x="9" y="9" width="5" height="5" rx="1" />
              </svg>
              <span>Knowledge Shelf</span>
            </button>

            <div className="dm-nav-item active">
              <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.4">
                <path d="M2.5 4.5A2.5 2.5 0 0 1 5 2h6a2.5 2.5 0 0 1 2.5 2.5v5A2.5 2.5 0 0 1 11 12H6.5L3 14.5V12a2.5 2.5 0 0 1-0.5-2.5v-5z" />
              </svg>
              <span>Active Conversation</span>
            </div>
          </nav>
        </div>

        <div className="dm-chat-sidebar-bottom">
          <div className="dm-chat-user">
            <div className="dm-avatar">{user?.username?.charAt(0).toUpperCase()}</div>
            <span className="dm-chat-username">{user?.username}</span>
          </div>
          <button onClick={handleLogout} className="dm-chat-logout-btn" title="Sign out">
            <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.4">
              <path d="M6 14H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h3" />
              <polyline points="10 11 13 8 10 5" />
              <line x1="13" y1="8" x2="4" y2="8" />
            </svg>
          </button>
        </div>
      </aside>

      {/* Main Conversation Stream */}
      <main className="dm-chat-main">
        {sourceParam && (
          <div className="dm-chat-filter-bar">
            <div className="dm-filter-info">
              <span className="dm-filter-label">Scoped Source:</span>
              <strong className="dm-filter-name">{sourceParam}</strong>
            </div>
            <button onClick={() => navigate('/chat')} className="dm-filter-clear-btn">
              Clear Filter (Search All)
            </button>
          </div>
        )}

        <div className="dm-messages-stream">
          {messages.map((msg, index) => (
            <div key={index} className={`dm-msg-row dm-msg-row--${msg.role}`}>
              <div className="dm-bubble">
                <div className="dm-bubble-text">{msg.content}</div>

                {msg.citations && msg.citations.length > 0 && (
                  <div className="dm-citations-panel">
                    <span className="dm-citations-title">Verified Citations</span>
                    <div className="dm-citations-list">
                      {msg.citations.map((cit, i) => (
                        <div key={i} className="dm-citation-chip">
                          <span className="dm-citation-badge">Passage #{cit.chunk_index + 1}</span>
                          <span className="dm-citation-source">{cit.source}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="dm-msg-row dm-msg-row--assistant">
              <div className="dm-bubble dm-bubble--typing">
                <span /><span /><span />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="dm-chat-bottom-bar">
          <form onSubmit={handleSend} className="dm-chat-input-form">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={sourceParam ? `Ask anything about ${sourceParam}...` : "Ask a question across your indexed documents..."}
              className="dm-chat-text-input"
              disabled={loading}
              autoFocus
            />
            <button type="submit" className="dm-chat-send-btn" disabled={loading || !input.trim()}>
              <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6">
                <line x1="3" y1="8" x2="13" y2="8" />
                <polyline points="9 4 13 8 9 12" />
              </svg>
            </button>
          </form>
          <span className="dm-chat-disclaimer">DocuMind references passages stored in your vector memory.</span>
        </div>
      </main>
    </div>
  );
}

export default Chat;
