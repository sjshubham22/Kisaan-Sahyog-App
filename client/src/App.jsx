import React, { useState, useEffect, useRef } from 'react';

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://127.0.0.1:8080/api'
  : '/api';
const DEFAULT_FARMER_ID = 'farmer_default_123';

function App() {
  const [messages, setMessages] = useState([
    {
      message_id: 'welcome',
      role: 'assistant',
      content: 'Welcome to Kisaan Sahyog, your trusted agricultural partner! How can I help you with your crops or weather today?'
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  
  // Farmer profile state
  const [profile, setProfile] = useState({
    name: 'Ramesh Yadav',
    phone: '+919876543210',
    district: 'Varanasi',
    state: 'Uttar Pradesh',
    primary_crop: 'Wheat',
    land_bigha: 3.5,
    irrigation: 'borewell'
  });

  // Active weather alerts
  const [alerts, setAlerts] = useState([]);
  const [quickReplies, setQuickReplies] = useState(['Sowing advice', 'Weather forecast', 'Mandi prices']);
  const [sessionId, setSessionId] = useState(`session_${Math.random().toString(36).substr(2, 9)}`);

  const messagesEndRef = useRef(null);

  // Load profile and alerts on startup
  useEffect(() => {
    fetchProfile();
    fetchAlerts();
  }, []);

  // Auto scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const getHeaders = () => ({
    'Content-Type': 'application/json'
  });

  const fetchProfile = async () => {
    try {
      const res = await fetch(`${API_BASE}/farmer/profile`, {
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    }
  };

  const fetchAlerts = async () => {
    try {
      const res = await fetch(`${API_BASE}/farmer/alerts`, {
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setAlerts(data);
      }
    } catch (err) {
      console.error('Error fetching alerts:', err);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/farmer/profile`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(profile)
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setShowProfile(false);
        // Refresh weather alerts for the new district
        fetchAlerts();
        
        // Add system message informing profile update
        setMessages(prev => [
          ...prev,
          {
            message_id: 'system_' + Date.now(),
            role: 'assistant',
            content: `Profile updated. Location set to ${data.district}, ${data.state} and primary crop to ${data.primary_crop}.`
          }
        ]);
      }
    } catch (err) {
      console.error('Error saving profile:', err);
    }
  };

  const handleDismissAlert = async () => {
    try {
      await fetch(`${API_BASE}/farmer/alerts/dismiss`, {
        method: 'POST',
        headers: getHeaders()
      });
      setAlerts([]);
    } catch (err) {
      console.error('Error dismissing alert:', err);
    }
  };

  const sendMessage = async (text) => {
    if (!text.trim()) return;

    // 1. Add user message
    const userMsg = {
      message_id: 'user_' + Date.now(),
      role: 'farmer',
      content: text
    };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    try {
      // 2. Post to backend
      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          farmer_id: DEFAULT_FARMER_ID,
          message: text,
          session_id: sessionId
        })
      });

      if (res.ok) {
        const data = await res.json();
        setIsTyping(false);
        
        // 3. Add bot message
        setMessages(prev => [
          ...prev,
          {
            message_id: 'bot_' + Date.now(),
            role: 'assistant',
            content: data.message,
            structured_data: data.structured_data,
            agents_used: data.agents_used
          }
        ]);
        
        if (data.quick_replies) {
          setQuickReplies(data.quick_replies);
        }

        // Check if query triggered new alert banners
        fetchAlerts();
      } else {
        const errData = await res.json();
        setIsTyping(false);
        setMessages(prev => [
          ...prev,
          {
            message_id: 'err_' + Date.now(),
            role: 'assistant',
            content: errData.error?.message || 'Sorry, I failed to process that request.'
          }
        ]);
      }
    } catch (err) {
      setIsTyping(false);
      setMessages(prev => [
        ...prev,
        {
          message_id: 'err_' + Date.now(),
          role: 'assistant',
          content: 'Unable to reach the advisor server. Please check your network connection.'
        }
      ]);
    }
  };

  const handleInputChange = (e) => {
    setInputText(e.target.value);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      sendMessage(inputText);
    }
  };

  const renderStructuredData = (data) => {
    if (!data) return null;

    if (data.type === 'crop_advisory') {
      return (
        <div className="advisory-card">
          <div className="card-header">
            <span>🌾</span> Crop Advisory Card
          </div>
          <div className="card-body">
            <div className="card-row">
              <span className="card-label">Variety:</span>
              <span className="card-value">{data.variety}</span>
            </div>
            <div className="card-row">
              <span className="card-label">Sowing Window:</span>
              <span className="card-value">{data.sowing_window}</span>
            </div>
            <div className="card-row">
              <span className="card-label">Fertilizer:</span>
              <span className="card-value">{data.fertiliser}</span>
            </div>
            <div className="card-row">
              <span className="card-label">Govt MSP Price:</span>
              <span className="card-value">{data.msp_price}</span>
            </div>
            <div className="card-row">
              <span className="card-label">Yield Estimate:</span>
              <span className="card-value">{data.yield_estimate}</span>
            </div>
            <div className="card-row">
              <span className="card-label">Irrigation:</span>
              <span className="card-value">{data.irrigation_advice}</span>
            </div>
          </div>
          <div className="card-sources">
            Sources: {data.data_sources?.join(', ')}
          </div>
        </div>
      );
    }

    if (data.type === 'weather_summary') {
      return (
        <div className="advisory-card">
          <div className="card-header">
            <span>🌤️</span> Weather Summary Card
          </div>
          <div className="card-body">
            <div className="card-row">
              <span className="card-label">Forecast:</span>
              <span className="card-value">{data.forecast_days}-Day Outlook</span>
            </div>
            <div className="card-row">
              <span className="card-label">Key Risk:</span>
              <span className="card-value" style={{ color: '#e76f51', fontWeight: 600 }}>{data.key_risk}</span>
            </div>
            <div className="card-row">
              <span className="card-label">Action Recommended:</span>
              <span className="card-value">{data.recommended_action}</span>
            </div>
          </div>
          <div className="card-sources">
            Sources: {data.data_sources?.join(', ')}
          </div>
        </div>
      );
    }

    if (data.type === 'combined_advisory') {
      return (
        <div className="advisory-card">
          <div className="card-header">
            <span>📊</span> Unified Crop & Weather Card
          </div>
          <div className="card-body">
            <div className="card-row">
              <span className="card-label">Variety:</span>
              <span className="card-value">{data.crop_variety}</span>
            </div>
            <div className="card-row">
              <span className="card-label">Sowing Window:</span>
              <span className="card-value">{data.sowing_window}</span>
            </div>
            <div className="card-row">
              <span className="card-label">Fertilizer:</span>
              <span className="card-value">{data.fertiliser}</span>
            </div>
            <div className="card-row">
              <span className="card-label">MSP Price:</span>
              <span className="card-value">{data.msp_price}</span>
            </div>
            <div className="card-row">
              <span className="card-label">Weather Risk:</span>
              <span className="card-value" style={{ color: '#e76f51', fontWeight: 600 }}>{data.weather_key_risk}</span>
            </div>
            <div className="card-row">
              <span className="card-label">Protection Action:</span>
              <span className="card-value">{data.weather_recommended_action}</span>
            </div>
          </div>
          <div className="card-sources">
            Sources: {data.data_sources?.join(', ')}
          </div>
        </div>
      );
    }

    if (data.type === 'market_price_card') {
      return (
        <div className="advisory-card">
          <div className="card-header">
            <span>💰</span> Mandi & MSP Pricing Card
          </div>
          <div className="card-body">
            <div className="card-row">
              <span className="card-label">Commodity:</span>
              <span className="card-value">{data.commodity}</span>
            </div>
            <div className="card-row">
              <span className="card-label">MSP Rate:</span>
              <span className="card-value">{data.msp_price}</span>
            </div>
            <div className="card-row">
              <span className="card-label">Typical Yield:</span>
              <span className="card-value">{data.yield_estimate}</span>
            </div>
            <div className="card-row">
              <span className="card-label">Recommended Variety:</span>
              <span className="card-value">{data.variety}</span>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="logo-section">
          <h1>Kisaan Sahyog</h1>
          <p>Advisory for {profile.name} ({profile.district})</p>
        </div>
        <div className="header-actions">
          <button className="icon-btn" onClick={() => fetchAlerts()}>
            <span>🔔</span>
            {alerts.length > 0 && <span className="badge-dot"></span>}
          </button>
          <button className="icon-btn" onClick={() => setShowProfile(true)}>
            <span>👤</span>
          </button>
        </div>
      </header>

      {/* Proactive alert banner if active alerts exist */}
      {alerts.length > 0 && (
        <div className="alert-banner">
          <div className="alert-content">
            <span className="alert-icon">⚠️</span>
            <div>
              <strong>{alerts[0].alert_type} Alert ({alerts[0].severity})</strong>
              <p>{alerts[0].message}</p>
            </div>
          </div>
          <button className="alert-close" onClick={handleDismissAlert}>✕</button>
        </div>
      )}

      {/* Chat Window */}
      <main className="chat-window">
        {messages.map((msg, index) => (
          <div key={msg.message_id || index} className={`message-row ${msg.role}`}>
            <div className="message-wrapper">
              <div className="message-bubble">
                <div className="message-text">{msg.content}</div>
              </div>
              {renderStructuredData(msg.structured_data)}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="message-row assistant">
            <div className="message-bubble" style={{ padding: '10px 14px' }}>
              <div className="typing-indicator">
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Quick Replies */}
      <div className="quick-replies-container">
        {quickReplies.map((reply, index) => (
          <button 
            key={index} 
            className="reply-chip"
            onClick={() => sendMessage(reply)}
          >
            {reply}
          </button>
        ))}
      </div>

      {/* Input Bar */}
      <div className="input-bar-container">
        <input 
          type="text" 
          className="chat-input" 
          placeholder="Ask about sowing, weather, or MSP..." 
          value={inputText}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
        />
        <button 
          className="send-btn" 
          onClick={() => sendMessage(inputText)}
          disabled={!inputText.trim()}
        >
          <span>➤</span>
        </button>
      </div>

      {/* Profile Panel Overlay */}
      {showProfile && (
        <div className="profile-overlay">
          <div className="profile-panel">
            <div className="profile-header">
              <h2>Farmer Profile Settings</h2>
              <button className="profile-close" onClick={() => setShowProfile(false)}>✕</button>
            </div>
            <form className="profile-body" onSubmit={handleSaveProfile}>
              <div className="form-group">
                <label>Farmer Name</label>
                <input 
                  type="text" 
                  value={profile.name}
                  onChange={e => setProfile({...profile, name: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Phone Number</label>
                <input 
                  type="text" 
                  value={profile.phone}
                  onChange={e => setProfile({...profile, phone: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>District</label>
                <select 
                  value={profile.district}
                  onChange={e => setProfile({...profile, district: e.target.value})}
                  required
                >
                  <option value="Varanasi">Varanasi (UP)</option>
                  <option value="Nashik">Nashik (Maharashtra)</option>
                  <option value="Pune">Pune (Maharashtra)</option>
                  <option value="Nagpur">Nagpur (Maharashtra)</option>
                  <option value="Ludhiana">Ludhiana (Punjab)</option>
                  <option value="Patna">Patna (Bihar)</option>
                  <option value="Hyderabad">Hyderabad (Telangana)</option>
                  <option value="Ahmedabad">Ahmedabad (Gujarat)</option>
                </select>
              </div>
              <div className="form-group">
                <label>State</label>
                <input 
                  type="text" 
                  value={profile.state}
                  onChange={e => setProfile({...profile, state: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Primary Crop</label>
                <select 
                  value={profile.primary_crop}
                  onChange={e => setProfile({...profile, primary_crop: e.target.value})}
                >
                  <option value="Wheat">Wheat</option>
                  <option value="Mustard">Mustard</option>
                  <option value="Rice">Rice</option>
                  <option value="Maize">Maize</option>
                  <option value="Cotton">Cotton</option>
                </select>
              </div>
              <div className="form-group">
                <label>Land Size (Bigha)</label>
                <input 
                  type="number" 
                  step="0.1" 
                  value={profile.land_bigha}
                  onChange={e => setProfile({...profile, land_bigha: parseFloat(e.target.value) || 0})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Irrigation Source</label>
                <select 
                  value={profile.irrigation}
                  onChange={e => setProfile({...profile, irrigation: e.target.value})}
                >
                  <option value="borewell">Borewell</option>
                  <option value="canal">Canal</option>
                  <option value="rainfed">Rainfed</option>
                  <option value="drip">Drip Irrigation</option>
                </select>
              </div>
              <button type="submit" className="save-profile-btn">Save Changes</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
