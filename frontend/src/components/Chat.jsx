import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
        const response = await api.get('/me/');
        setUser(response.data);
        setMessages([{
          role: 'assistant',
          content: sourceParam 
            ? `Hello! I am DocuMind. Ask me anything about ${sourceParam}.` 
            : 'Hello! I am DocuMind. Ask me anything about the documents you have ingested.',
          citations: []
        }]);
      } catch (err) {
        navigate('/login');
      }
    };
    fetchUser();
  }, [navigate]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const payload = { 
        question: userMessage, 
        top_k: 3,
        user_id: user.id
      };
      if (sourceParam) {
        payload.source = sourceParam;
      }
      
      const response = await ragApi.post('/query', payload);
      
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: response.data.answer,
        citations: response.data.citations
      }]);
    } catch (err) {
      setMessages(prev => [...prev, { 
        role: 'error', 
        content: err.response?.data?.detail || 'An error occurred while generating the answer.' 
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.post('/logout/');
      navigate('/login');
    } catch (err) {
      console.error('Logout failed');
    }
  };

  return (
    <div className="chat-layout">
      <div className="chat-sidebar">
        <div className="sidebar-header">
          <h2>DocuMind</h2>
        </div>
        <div className="sidebar-content">
          <button onClick={() => navigate('/dashboard')} className="sidebar-item">
            <span className="icon">📄</span> Manage Knowledge
          </button>
          <div className="sidebar-item active">
            <span className="icon">💬</span> Chat
          </div>
        </div>
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="avatar">{user?.username?.charAt(0).toUpperCase()}</div>
            <span>{user?.username}</span>
          </div>
          <button onClick={handleLogout} className="logout-icon-btn" title="Logout">
            🚪
          </button>
        </div>
      </div>

      <div className="chat-main">
        {sourceParam && (
          <div className="chat-context-banner">
            Chatting specifically about: <strong>{sourceParam}</strong>
            <button onClick={() => navigate('/chat')} className="btn outline-btn btn-small">Clear Filter</button>
          </div>
        )}
        <div className="messages-container">
          {messages.map((msg, index) => (
            <div key={index} className={`message-wrapper ${msg.role}`}>
              <div className="message-bubble">
                <div className="message-content">{msg.content}</div>
                {msg.citations && msg.citations.length > 0 && (
                  <div className="citations">
                    <h4>Sources:</h4>
                    {msg.citations.map((cit, i) => (
                      <div key={i} className="citation-item">
                        <span className="citation-badge">[{cit.chunk_index}]</span> {cit.source}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="message-wrapper assistant">
              <div className="message-bubble typing">
                <div className="dot"></div>
                <div className="dot"></div>
                <div className="dot"></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="input-area">
          <form onSubmit={handleSend} className="chat-form">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question about your documents..."
              className="chat-input"
              disabled={loading}
            />
            <button type="submit" className="send-btn" disabled={loading || !input.trim()}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
            </button>
          </form>
          <div className="chat-footer">
            DocuMind uses RAG to answer from your knowledge base.
          </div>
        </div>
      </div>
    </div>
  );
}

export default Chat;
