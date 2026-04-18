import { useState, useEffect } from 'react';
import { R, DK, GR, BD, LR, MID } from '../lib/constants';
import { saveApiKey, removeApiKey, upsertProfile, getCompanyMembers, regenerateInviteCode, removeMember } from '../lib/supabase';
import { testApiKey } from '../lib/ai';

const iS = { width: '100%', border: `1.5px solid ${BD}`, borderRadius: 8, padding: '10px 13px', fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' };
const lS = { fontSize: 11, fontWeight: 700, color: GR, textTransform: 'uppercase', letterSpacing: .4, display: 'block', marginBottom: 5 };

function SectionCard({ title, subtitle, children }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: `1px solid ${BD}`, overflow: 'hidden', marginBottom: 16 }}>
      <div style={{ padding: '16px 22px', borderBottom: `1px solid ${BD}`, background: '#fafafa' }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: DK }}>{title}</div>
        {subtitle && <div style={{ fontSize: 13, color: GR, marginTop: 3 }}>{subtitle}</div>}
      </div>
      <div style={{ padding: '20px 22px' }}>{children}</div>
    </div>
  );
}

// ─── Claude API Key Panel ────────────────────────────────────────────────────
function ApiKeyPanel({ userId, existingKey, onKeyChange }) {
  const [keyInput, setKeyInput] = useState('');
  const [visible, setVisible] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null); // null | 'ok' | 'fail'
  const [err, setErr] = useState('');

  const hasKey = !!existingKey;
  const masked = existingKey ? existingKey.slice(0, 8) + '••••••••••••••••••••' + existingKey.slice(-4) : '';

  async function handleTest() {
    const key = keyInput.trim();
    if (!key) return;
    setTesting(true); setErr(''); setStatus(null);
    try {
      const ok = await testApiKey(key);
      setStatus(ok ? 'ok' : 'fail');
      if (!ok) setErr('Key authenticated but received unexpected response.');
    } catch (ex) {
      setStatus('fail');
      setErr(ex.message === 'INVALID_KEY' ? 'Invalid API key. Please double-check.' : ex.message);
    }
    setTesting(false);
  }

  async function handleSave() {
    const key = keyInput.trim();
    if (!key) return;
    setSaving(true); setErr('');
    try {
      await saveApiKey(userId, key);
      onKeyChange(key);
      setKeyInput('');
      setStatus(null);
    } catch (ex) { setErr(ex.message); }
    setSaving(false);
  }

  async function handleRemove() {
    if (!window.confirm('Remove your Claude API key? AI features will be disabled.')) return;
    await removeApiKey(userId);
    onKeyChange(null);
    setStatus(null); setErr('');
  }

  return (
    <div>
      {/* Status banner */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 10, background: hasKey ? '#f0fdf4' : '#fff8f8', border: `1px solid ${hasKey ? '#86efac' : '#fca5a5'}`, marginBottom: 20 }}>
        <span style={{ fontSize: 22 }}>{hasKey ? '✅' : '⚠️'}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: hasKey ? '#15803d' : '#dc2626' }}>
            {hasKey ? 'Claude API connected' : 'Claude API not connected'}
          </div>
          <div style={{ fontSize: 12, color: GR, marginTop: 2 }}>
            {hasKey ? `Key: ${masked}` : 'Connect your key to enable AI features across all tools'}
          </div>
        </div>
        {hasKey && (
          <button onClick={handleRemove} style={{ background: LR, color: R, border: `1px solid ${R}`, borderRadius: 7, padding: '5px 12px', cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'inherit' }}>
            Disconnect
          </button>
        )}
      </div>

      {/* What you unlock */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: GR, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 10 }}>Features unlocked with your key</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            ['✨', 'AI transcript → MoM parsing', true],
            ['💡', 'Smart meeting suggestions', true],
            ['📄', 'SOW Generator (coming soon)', false],
            ['💼', 'Proposal Generator (coming soon)', false],
          ].map(([icon, label, ready]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: ready ? '#f0f9ff' : '#f9f9f9', borderRadius: 8, border: `1px solid ${ready ? '#bae6fd' : BD}` }}>
              <span>{icon}</span>
              <span style={{ fontSize: 12, color: ready ? '#0369a1' : '#aaa' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Input */}
      <div>
        <label style={lS}>{hasKey ? 'Replace API Key' : 'Enter Claude API Key'}</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              type={visible ? 'text' : 'password'}
              style={{ ...iS, paddingRight: 40, fontFamily: 'DM Mono, monospace', fontSize: 13 }}
              value={keyInput}
              onChange={e => { setKeyInput(e.target.value); setStatus(null); setErr(''); }}
              placeholder="sk-ant-api03-…"
            />
            <button onClick={() => setVisible(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: GR }}>
              {visible ? '🙈' : '👁'}
            </button>
          </div>
          <button onClick={handleTest} disabled={!keyInput.trim() || testing} style={{ background: '#f0f0f0', border: `1px solid ${BD}`, borderRadius: 8, padding: '0 14px', cursor: keyInput.trim() ? 'pointer' : 'not-allowed', fontWeight: 600, fontSize: 13, fontFamily: 'inherit', color: DK, whiteSpace: 'nowrap' }}>
            {testing ? '…' : 'Test'}
          </button>
          <button onClick={handleSave} disabled={!keyInput.trim() || saving || status === 'fail'} style={{ background: keyInput.trim() && status !== 'fail' ? R : '#ccc', color: '#fff', border: 'none', borderRadius: 8, padding: '0 16px', cursor: keyInput.trim() && status !== 'fail' ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: 13, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
            {saving ? 'Saving…' : 'Save Key'}
          </button>
        </div>
        {status === 'ok' && <p style={{ color: '#16a34a', fontSize: 13, marginTop: 7 }}>✓ Key is valid and working!</p>}
        {err && <p style={{ color: R, fontSize: 13, marginTop: 7 }}>⚠ {err}</p>}
        <p style={{ fontSize: 12, color: '#aaa', marginTop: 8 }}>
          🔒 Your key is stored securely in the database. It's never shared with other users.
          Get your key at <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" style={{ color: R }}>console.anthropic.com</a>
        </p>
      </div>
    </div>
  );
}

// ─── Team Panel ───────────────────────────────────────────────────────────────
function TeamPanel({ company, userId, isOwner, onCompanyUpdate }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    if (!company?.id) return;
    getCompanyMembers(company.id).then(setMembers).finally(() => setLoading(false));
  }, [company?.id]);

  function copyCode() {
    navigator.clipboard.writeText(company.invite_code || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleRegenerate() {
    if (!window.confirm('Regenerate invite code? The old one will stop working.')) return;
    setRegenerating(true);
    try {
      const updated = await regenerateInviteCode(company.id);
      onCompanyUpdate(updated);
    } catch {}
    setRegenerating(false);
  }

  async function handleRemove(memberId, memberName) {
    if (!window.confirm(`Remove ${memberName} from the company?`)) return;
    try {
      await removeMember(company.id, memberId);
      setMembers(m => m.filter(x => x.user_id !== memberId));
    } catch {}
  }

  return (
    <div>
      {/* Company info */}
      <div style={{ padding: '14px 16px', background: '#f9f9f9', borderRadius: 10, border: `1px solid ${BD}`, marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: DK }}>{company?.name}</div>
        <div style={{ fontSize: 12, color: GR, marginTop: 3 }}>{members.length} member{members.length !== 1 ? 's' : ''}</div>
      </div>

      {/* Invite code */}
      {isOwner && (
        <div style={{ marginBottom: 20 }}>
          <label style={lS}>Invite Code</label>
          <p style={{ fontSize: 12, color: GR, marginBottom: 10 }}>Share this code with teammates so they can join your workspace during signup.</p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ flex: 1, background: '#f0f0f0', border: `1.5px solid ${BD}`, borderRadius: 8, padding: '11px 16px', fontFamily: 'DM Mono, monospace', fontSize: 18, fontWeight: 700, letterSpacing: 4, color: DK, textAlign: 'center' }}>
              {company?.invite_code || '—'}
            </div>
            <button onClick={copyCode} style={{ background: copied ? '#16a34a' : DK, color: '#fff', border: 'none', borderRadius: 8, padding: '11px 16px', cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit' }}>
              {copied ? '✓ Copied!' : 'Copy'}
            </button>
            <button onClick={handleRegenerate} disabled={regenerating} style={{ background: LR, color: R, border: `1px solid ${R}`, borderRadius: 8, padding: '11px 12px', cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit' }}>
              {regenerating ? '…' : '🔄'}
            </button>
          </div>
        </div>
      )}

      {/* Members list */}
      <div>
        <label style={lS}>Members ({members.length})</label>
        {loading
          ? <div style={{ color: '#aaa', fontSize: 13 }}>Loading…</div>
          : members.map(m => {
            const p = m.profiles;
            const isSelf = m.user_id === userId;
            const hasKey = !!p?.claude_api_key;
            return (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid ${BD}` }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: R, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                  {(p?.full_name || p?.email || '?')[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: DK, display: 'flex', alignItems: 'center', gap: 7 }}>
                    {p?.full_name || 'No name'}
                    {isSelf && <span style={{ background: '#dbeafe', color: '#1a73e8', borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>You</span>}
                    {m.role === 'owner' && <span style={{ background: LR, color: R, borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>Owner</span>}
                  </div>
                  <div style={{ fontSize: 12, color: GR, marginTop: 2 }}>{p?.email}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span title={hasKey ? 'Claude API connected' : 'No Claude API key'} style={{ fontSize: 16 }}>{hasKey ? '🤖' : '○'}</span>
                  {isOwner && !isSelf && (
                    <button onClick={() => handleRemove(m.user_id, p?.full_name || p?.email)} style={{ background: LR, color: R, border: `1px solid ${R}`, borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}>
                      Remove
                    </button>
                  )}
                </div>
              </div>
            );
          })
        }
      </div>
    </div>
  );
}

// ─── Profile Page ─────────────────────────────────────────────────────────────
export default function ProfilePage({ profile, company, onProfileUpdate, userId, defaultTab = 'profile' }) {
  const [tab, setTab] = useState(defaultTab);
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [currentCompany, setCurrentCompany] = useState(company);

  const isOwner = company?.created_by === userId;

  async function handleSaveProfile() {
    setSavingProfile(true); setProfileMsg('');
    try {
      const updated = await upsertProfile(userId, { full_name: fullName });
      onProfileUpdate({ ...profile, ...updated });
      setProfileMsg('✓ Saved!');
    } catch (ex) { setProfileMsg('⚠ ' + ex.message); }
    setSavingProfile(false);
    setTimeout(() => setProfileMsg(''), 3000);
  }

  function handleKeyChange(key) {
    onProfileUpdate({ ...profile, claude_api_key: key });
  }

  const tabBtn = (id, label, icon) => (
    <button onClick={() => setTab(id)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', border: 'none', borderBottom: `3px solid ${tab === id ? R : 'transparent'}`, background: 'none', color: tab === id ? R : GR, fontWeight: tab === id ? 700 : 500, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}>
      {icon} {label}
    </button>
  );

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 20px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: DK, marginBottom: 4 }}>Settings</h1>
      <p style={{ fontSize: 14, color: GR, marginBottom: 24 }}>Manage your profile, integrations and team.</p>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${BD}`, marginBottom: 24 }}>
        {tabBtn('profile', 'Profile', '👤')}
        {tabBtn('integrations', 'Integrations', '🔌')}
        {tabBtn('team', 'Team & Company', '🏢')}
      </div>

      {tab === 'profile' && (
        <SectionCard title="Personal Information" subtitle="Update your name and account details">
          <div style={{ marginBottom: 16 }}>
            <label style={lS}>Full Name</label>
            <input style={iS} value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={lS}>Email Address</label>
            <input style={{ ...iS, background: '#f9f9f9', color: GR }} value={profile?.email || ''} disabled />
            <p style={{ fontSize: 12, color: '#aaa', marginTop: 5 }}>Email is managed via your authentication and cannot be changed here.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={handleSaveProfile} disabled={savingProfile} style={{ background: R, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
              {savingProfile ? 'Saving…' : 'Save Changes'}
            </button>
            {profileMsg && <span style={{ fontSize: 13, color: profileMsg.startsWith('✓') ? '#16a34a' : R }}>{profileMsg}</span>}
          </div>
        </SectionCard>
      )}

      {tab === 'integrations' && (
        <>
          <SectionCard
            title="🤖 Claude AI (Anthropic)"
            subtitle="Connect your Claude API key to enable AI features across all Ksolves tools."
          >
            <ApiKeyPanel userId={userId} existingKey={profile?.claude_api_key} onKeyChange={handleKeyChange} />
          </SectionCard>

          {/* Future integrations placeholder */}
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 12 }}>Coming Soon</div>
            {[
              { icon: '🔗', name: 'Slack', desc: 'Post MoM summaries and action items to Slack channels.' },
              { icon: '📅', name: 'Google Calendar', desc: 'Auto-create follow-up meetings from action items.' },
              { icon: '📧', name: 'Gmail / Outlook', desc: 'Send MoM emails directly from the tool.' },
            ].map(item => (
              <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', background: '#fafafa', border: `1px solid ${BD}`, borderRadius: 10, marginBottom: 8, opacity: .6 }}>
                <span style={{ fontSize: 24 }}>{item.icon}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: DK }}>{item.name}</div>
                  <div style={{ fontSize: 12, color: GR }}>{item.desc}</div>
                </div>
                <span style={{ marginLeft: 'auto', background: '#ebebeb', color: '#888', borderRadius: 6, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>Soon</span>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'team' && (
        <SectionCard title="Team & Company" subtitle={isOwner ? 'You are the owner of this workspace' : 'Your company workspace'}>
          <TeamPanel
            company={currentCompany}
            userId={userId}
            isOwner={isOwner}
            onCompanyUpdate={c => setCurrentCompany(c)}
          />
        </SectionCard>
      )}
    </div>
  );
}
