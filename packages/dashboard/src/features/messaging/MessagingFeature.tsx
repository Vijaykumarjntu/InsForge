import React, { useState } from 'react';

export function MessagingFeature() {
  const [activeTab, setActiveTab] = useState<'send' | 'logs'>('send');
  const [channel, setChannel] = useState<'SMS' | 'EMAIL' | 'PUSH'>('SMS');
  const [recipient, setRecipient] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const inputStyle = { 
    width: '100%', 
    padding: '10px', 
    marginTop: '6px', 
    borderRadius: '6px', 
    border: '1px solid #cbd5e1', 
    boxSizing: 'border-box' as const,
    fontSize: '14px'
  };
  
  const tabStyle = (active: boolean) => ({ 
    padding: '12px 24px', 
    cursor: 'pointer', 
    borderBottom: active ? '2px solid #2563eb' : '2px solid transparent', 
    fontWeight: active ? 600 : 400, 
    color: active ? '#2563eb' : '#64748b',
    transition: 'all 0.2s'
  });

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    try {
      const res = await fetch('http://localhost:7130/api/messaging/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          channel, 
          to: recipient, 
          subject: channel === 'EMAIL' ? subject : undefined, 
          body 
        }),
      });

      if (!res.ok) throw new Error(`Dispatch failed with status ${res.status}`);

      setStatus({ type: 'success', text: `Notification successfully routed through the mock execution layer!` });
      setRecipient('');
      setSubject('');
      setBody('');
    } catch (err: any) {
      setStatus({ type: 'error', text: err.message || 'Network dispatch error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '32px', maxWidth: '800px', margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#0f172a', margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>Unified Messaging Layer</h1>
        <p style={{ color: '#64748b', margin: 0, fontSize: '15px' }}>Orchestrate cross-channel notification workflows utilizing persistent driver configurations.</p>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: '24px' }}>
        <div style={tabStyle(activeTab === 'send')} onClick={() => setActiveTab('send')}>Compose & Dispatch</div>
        <div style={tabStyle(activeTab === 'logs')} onClick={() => setActiveTab('logs')}>Delivery Records</div>
      </div>

      {activeTab === 'send' ? (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <form onSubmit={handleSend}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '14px', fontWeight: 600, color: '#334155' }}>Protocol Strategy</label>
              <select value={channel} onChange={(e) => setChannel(e.target.value as any)} style={inputStyle}>
                <option value="SMS">SMS Gateway (Mock Driver)</option>
                <option value="EMAIL">Email Transport SMTP (Mock Driver)</option>
                <option value="PUSH">APNS/FCM Push (Mock Driver)</option>
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '14px', fontWeight: 600, color: '#334155' }}>
                {channel === 'EMAIL' ? 'Destination Email Address' : channel === 'SMS' ? 'Recipient Destination String (E.164)' : 'Device Identifier Token'}
              </label>
              <input type="text" required value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder={channel === 'EMAIL' ? 'target@domain.com' : '+1234567890'} style={inputStyle} />
            </div>

            {channel === 'EMAIL' && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '14px', fontWeight: 600, color: '#334155' }}>Subject Header</label>
                <input type="text" required value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="System Alert Payload" style={inputStyle} />
              </div>
            )}

            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontSize: '14px', fontWeight: 600, color: '#334155' }}>Message Content Body</label>
              <textarea rows={5} required value={body} onChange={(e) => setBody(e.target.value)} placeholder="Enter dispatch content raw text..." style={{ ...inputStyle, resize: 'vertical' }} />
            </div>

            <button type="submit" disabled={loading} style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '6px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', width: '100%', fontSize: '15px' }}>
              {loading ? 'Executing Transmission...' : 'Transmit Operational Signal'}
            </button>
          </form>

          {status && (
            <div style={{ marginTop: '20px', padding: '14px', borderRadius: '8px', fontSize: '14px', background: status.type === 'success' ? '#f0fdf4' : '#fef2f2', color: status.type === 'success' ? '#166534' : '#991b1b', border: `1px solid ${status.type === 'success' ? '#bbf7d0' : '#fecaca'}` }}>
              {status.text}
            </div>
          )}
        </div>
      ) : (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '40px 24px', color: '#64748b', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <p style={{ margin: '0 0 8px 0', fontWeight: 500, color: '#334155' }}>Database tracking link initialized</p>
          <p style={{ margin: 0, fontSize: '14px' }}>Real-time logging table tracking is fully available inside your operational container log pools.</p>
        </div>
      )}
    </div>
  );
}
