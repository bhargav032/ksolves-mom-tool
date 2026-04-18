import { useState, useEffect, useCallback } from 'react';
import { supabase, sendOTP, verifyOTP, signOut, getProfile, upsertProfile, createCompany, getCompanyByInviteCode, joinCompany } from './lib/supabase';
import { R, DK, GR, BD, BG, MID, TOOLS } from './lib/constants';
import MomTool from './pages/MomTool';
import ProfilePage from './pages/ProfilePage';
import ToolsHub from './pages/ToolsHub';

// ─── Auth screens ───────────────────────────────────────────────────────────
function AuthScreen({ onDone }) {
  const [step, setStep] = useState('email'); // email | otp
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [sent, setSent] = useState(false);

  async function handleEmail(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true); setErr('');
    try {
      await sendOTP(email.trim().toLowerCase());
      setSent(true); setStep('otp');
    } catch (ex) { setErr(ex.message); }
    setLoading(false);
  }

  async function handleOtp(e) {
    e.preventDefault();
    if (otp.length < 6) return;
    setLoading(true); setErr('');
    try {
      await verifyOTP(email.trim().toLowerCase(), otp.trim());
      onDone();
    } catch (ex) { setErr('Invalid or expired code. Please try again.'); }
    setLoading(false);
  }

  const inp = {
    width: '100%', border: `2px solid ${BD}`, borderRadius: 10, padding: '12px 14px',
    fontSize: 15, outline: 'none', fontFamily: 'inherit', transition: 'border-color .15s',
    boxSizing: 'border-box',
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1A1A1A 0%, #2d0a0e 50%, #1A1A1A 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ background: R, borderRadius: 10, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 20, color: '#fff' }}>K</div>
            <span style={{ color: '#fff', fontWeight: 800, fontSize: 22 }}>Ksolves</span>
          </div>
          <div style={{ color: '#aaa', fontSize: 13, letterSpacing: 1 }}>WORKSPACE TOOLS</div>
        </div>

        <div style={{ background: '#fff', borderRadius: 16, padding: 36, boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}>
          {step === 'email' ? (
            <>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: DK, marginBottom: 6 }}>Welcome back</h2>
              <p style={{ color: GR, fontSize: 14, marginBottom: 28 }}>Enter your work email to continue. We'll send a one-time code.</p>
              <form onSubmit={handleEmail}>
                <label style={{ fontSize: 11, fontWeight: 700, color: GR, textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 6 }}>Work Email</label>
                <input style={inp} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@yourcompany.com" autoFocus required />
                {err && <p style={{ color: R, fontSize: 13, marginTop: 8 }}>⚠ {err}</p>}
                <button type="submit" disabled={loading} style={{ marginTop: 20, width: '100%', background: loading ? '#ccc' : R, color: '#fff', border: 'none', borderRadius: 10, padding: '13px 0', fontWeight: 700, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                  {loading ? 'Sending code…' : 'Send verification code →'}
                </button>
              </form>
            </>
          ) : (
            <>
              <button onClick={() => { setStep('email'); setOtp(''); setErr(''); }} style={{ background: 'none', border: 'none', color: GR, cursor: 'pointer', fontSize: 13, padding: '0 0 16px', fontFamily: 'inherit' }}>← Back</button>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: DK, marginBottom: 6 }}>Check your inbox</h2>
              <p style={{ color: GR, fontSize: 14, marginBottom: 4 }}>We sent a 6-digit code to</p>
              <p style={{ color: DK, fontWeight: 700, fontSize: 15, marginBottom: 28 }}>{email}</p>
              <form onSubmit={handleOtp}>
                <label style={{ fontSize: 11, fontWeight: 700, color: GR, textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 6 }}>Verification Code</label>
                <input style={{ ...inp, fontSize: 24, letterSpacing: 8, textAlign: 'center', fontFamily: 'DM Mono, monospace' }} value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" autoFocus maxLength={6} />
                {err && <p style={{ color: R, fontSize: 13, marginTop: 8 }}>⚠ {err}</p>}
                <button type="submit" disabled={loading || otp.length < 6} style={{ marginTop: 20, width: '100%', background: otp.length < 6 || loading ? '#ccc' : R, color: '#fff', border: 'none', borderRadius: 10, padding: '13px 0', fontWeight: 700, fontSize: 15, cursor: otp.length < 6 || loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                  {loading ? 'Verifying…' : 'Verify & Continue →'}
                </button>
                <button type="button" onClick={handleEmail} style={{ marginTop: 12, width: '100%', background: 'none', border: 'none', color: GR, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Didn't receive it? Resend
                </button>
              </form>
            </>
          )}
        </div>
        <p style={{ textAlign: 'center', color: '#666', fontSize: 12, marginTop: 20 }}>
          🔒 Email-based 2FA — no passwords required
        </p>
      </div>
    </div>
  );
}

// ─── Company Setup ──────────────────────────────────────────────────────────
function CompanySetup({ userId, userEmail, onDone }) {
  const [mode, setMode] = useState(null); // null | 'create' | 'join'
  const [name, setName] = useState('');
  const [fullName, setFullName] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function handleCreate(e) {
    e.preventDefault();
    if (!name.trim() || !fullName.trim()) return;
    setLoading(true); setErr('');
    try {
      const company = await createCompany(name.trim(), userId);
      const profile = await upsertProfile(userId, { email: userEmail, full_name: fullName.trim(), company_id: company.id });
      onDone(profile);
    } catch (ex) { setErr(ex.message); }
    setLoading(false);
  }

  async function handleJoin(e) {
    e.preventDefault();
    if (!code.trim() || !fullName.trim()) return;
    setLoading(true); setErr('');
    try {
      const company = await getCompanyByInviteCode(code.trim());
      await joinCompany(company.id, userId);
      const profile = await upsertProfile(userId, { email: userEmail, full_name: fullName.trim(), company_id: company.id });
      onDone(profile);
    } catch (ex) { setErr(ex.message); }
    setLoading(false);
  }

  const inp = { width: '100%', border: `2px solid ${BD}`, borderRadius: 10, padding: '11px 14px', fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 12 };
  const card = (active, onClick, icon, title, desc) => (
    <div onClick={onClick} style={{ border: `2px solid ${active ? R : BD}`, borderRadius: 12, padding: '16px 20px', cursor: 'pointer', background: active ? '#fff8f8' : '#fff', transition: 'all .15s', marginBottom: 10 }}>
      <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontWeight: 700, fontSize: 15, color: DK }}>{title}</div>
      <div style={{ fontSize: 13, color: GR, marginTop: 3 }}>{desc}</div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1A1A1A 0%, #2d0a0e 50%, #1A1A1A 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 36, width: '100%', maxWidth: 460, boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <div style={{ background: R, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#fff' }}>K</div>
          <span style={{ fontWeight: 800, fontSize: 18, color: DK }}>Set up your workspace</span>
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: GR, textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 6 }}>Your Full Name</label>
          <input style={inp} value={fullName} onChange={e => setFullName(e.target.value)} placeholder="e.g. Bhargav Patel" />
        </div>
        {!mode && (
          <div>
            <p style={{ fontSize: 13, color: GR, marginBottom: 12 }}>How would you like to continue?</p>
            {card(false, () => setMode('create'), '🏢', 'Create a new company', 'Set up a workspace for your team')}
            {card(false, () => setMode('join'), '🔗', 'Join an existing company', 'Use an invite code from your team')}
          </div>
        )}
        {mode === 'create' && (
          <form onSubmit={handleCreate}>
            <button type="button" onClick={() => { setMode(null); setErr(''); }} style={{ background: 'none', border: 'none', color: GR, cursor: 'pointer', fontSize: 13, padding: '0 0 12px', fontFamily: 'inherit' }}>← Back</button>
            <label style={{ fontSize: 11, fontWeight: 700, color: GR, textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 6 }}>Company Name</label>
            <input style={inp} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Ksolves India Limited" required />
            {err && <p style={{ color: R, fontSize: 13, marginBottom: 8 }}>⚠ {err}</p>}
            <button type="submit" disabled={loading || !name.trim() || !fullName.trim()} style={{ width: '100%', background: !name.trim() || !fullName.trim() || loading ? '#ccc' : R, color: '#fff', border: 'none', borderRadius: 10, padding: '13px 0', fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>
              {loading ? 'Creating…' : '🏢 Create Workspace →'}
            </button>
          </form>
        )}
        {mode === 'join' && (
          <form onSubmit={handleJoin}>
            <button type="button" onClick={() => { setMode(null); setErr(''); }} style={{ background: 'none', border: 'none', color: GR, cursor: 'pointer', fontSize: 13, padding: '0 0 12px', fontFamily: 'inherit' }}>← Back</button>
            <label style={{ fontSize: 11, fontWeight: 700, color: GR, textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 6 }}>Invite Code</label>
            <input style={{ ...inp, textTransform: 'uppercase', fontFamily: 'DM Mono, monospace', letterSpacing: 3, fontSize: 16 }} value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="XXXXXXXX" required />
            {err && <p style={{ color: R, fontSize: 13, marginBottom: 8 }}>⚠ {err}</p>}
            <button type="submit" disabled={loading || !code.trim() || !fullName.trim()} style={{ width: '100%', background: !code.trim() || !fullName.trim() || loading ? '#ccc' : R, color: '#fff', border: 'none', borderRadius: 10, padding: '13px 0', fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>
              {loading ? 'Joining…' : '🔗 Join Workspace →'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────
function Sidebar({ activeTool, setActiveTool, profile, company, onSignOut }) {
  const [collapsed, setCollapsed] = useState(false);

  const navBtn = (id, icon, label, badge) => {
    const isActive = activeTool === id;
    return (
      <button key={id} onClick={() => setActiveTool(id)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: isActive ? R : 'transparent', color: isActive ? '#fff' : '#ccc', border: 'none', borderRadius: 8, padding: collapsed ? '10px 0' : '9px 12px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: isActive ? 700 : 500, textAlign: 'left', justifyContent: collapsed ? 'center' : 'flex-start', transition: 'all .15s', marginBottom: 2 }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
        {!collapsed && <span style={{ flex: 1 }}>{label}</span>}
        {!collapsed && badge && <span style={{ background: 'rgba(255,255,255,0.2)', fontSize: 10, borderRadius: 10, padding: '1px 7px', fontWeight: 700 }}>{badge}</span>}
      </button>
    );
  };

  return (
    <div style={{ width: collapsed ? 56 : 220, minHeight: '100vh', background: DK, display: 'flex', flexDirection: 'column', transition: 'width .2s', flexShrink: 0, position: 'relative' }}>
      {/* Logo */}
      <div style={{ padding: collapsed ? '18px 10px' : '18px 16px', borderBottom: '1px solid #333', display: 'flex', alignItems: 'center', gap: 10, justifyContent: collapsed ? 'center' : 'flex-start' }}>
        <div style={{ background: R, borderRadius: 7, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 14, color: '#fff', flexShrink: 0 }}>K</div>
        {!collapsed && <span style={{ color: '#fff', fontWeight: 800, fontSize: 15 }}>Ksolves Tools</span>}
      </div>

      {/* Collapse toggle */}
      <button onClick={() => setCollapsed(c => !c)} style={{ position: 'absolute', top: 22, right: -12, background: '#333', border: '2px solid #555', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#aaa', fontSize: 10, zIndex: 10 }}>
        {collapsed ? '›' : '‹'}
      </button>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
        {!collapsed && <div style={{ fontSize: 10, color: '#666', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, padding: '4px 8px 8px' }}>Tools</div>}
        {TOOLS.map(t => {
          const badge = t.status === 'coming_soon' ? 'Soon' : t.status === 'beta' ? 'Beta' : null;
          const isDisabled = t.status !== 'active';
          return (
            <button key={t.id} onClick={() => !isDisabled && setActiveTool(t.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: activeTool === t.id ? R : 'transparent', color: activeTool === t.id ? '#fff' : isDisabled ? '#555' : '#ccc', border: 'none', borderRadius: 8, padding: collapsed ? '10px 0' : '9px 12px', cursor: isDisabled ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: activeTool === t.id ? 700 : 500, textAlign: 'left', justifyContent: collapsed ? 'center' : 'flex-start', transition: 'all .15s', marginBottom: 2 }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{t.icon}</span>
              {!collapsed && <><span style={{ flex: 1 }}>{t.label}</span>{badge && <span style={{ background: activeTool === t.id ? 'rgba(255,255,255,0.25)' : '#2a2a2a', color: activeTool === t.id ? '#fff' : '#888', fontSize: 9, borderRadius: 10, padding: '2px 6px', fontWeight: 700 }}>{badge}</span>}</>}
            </button>
          );
        })}

        <div style={{ height: 1, background: '#2a2a2a', margin: '12px 8px' }} />
        {!collapsed && <div style={{ fontSize: 10, color: '#666', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, padding: '4px 8px 8px' }}>Account</div>}
        {navBtn('profile', '👤', 'Profile & Settings')}
        {navBtn('team', '🏢', 'Team & Company')}
      </nav>

      {/* User footer */}
      <div style={{ padding: '12px 8px', borderTop: '1px solid #2a2a2a' }}>
        {!collapsed && (
          <div style={{ padding: '8px 12px', marginBottom: 6 }}>
            <div style={{ color: '#fff', fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile?.full_name || 'User'}</div>
            <div style={{ color: '#666', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile?.email}</div>
            {company && <div style={{ color: '#555', fontSize: 10, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🏢 {company.name}</div>}
          </div>
        )}
        <button onClick={onSignOut} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'transparent', color: '#666', border: 'none', borderRadius: 8, padding: collapsed ? '8px 0' : '8px 12px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, justifyContent: collapsed ? 'center' : 'flex-start' }}>
          <span>⏏</span>{!collapsed && 'Sign out'}
        </button>
      </div>
    </div>
  );
}

// ─── Main App ────────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading
  const [profile, setProfile] = useState(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [activeTool, setActiveTool] = useState('mom');

  // Listen for auth changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load profile when session available
  useEffect(() => {
    if (!session?.user) { setProfile(null); return; }
    getProfile(session.user.id).then(p => {
      if (!p || !p.company_id) setNeedsSetup(true);
      else { setProfile(p); setNeedsSetup(false); }
    }).catch(() => setNeedsSetup(true));
  }, [session]);

  const handleAuthDone = useCallback(() => {
    // session will update via onAuthStateChange
  }, []);

  const handleSetupDone = useCallback((p) => {
    setProfile(p);
    setNeedsSetup(false);
  }, []);

  const handleSignOut = useCallback(async () => {
    await signOut();
    setProfile(null);
  }, []);

  // Loading
  if (session === undefined) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1A1A1A' }}>
        <div style={{ color: '#666', fontSize: 14 }}>Loading…</div>
      </div>
    );
  }

  // Not logged in
  if (!session) return <AuthScreen onDone={handleAuthDone} />;

  // Logged in but no company
  if (needsSetup) return <CompanySetup userId={session.user.id} userEmail={session.user.email} onDone={handleSetupDone} />;

  // Logged in with company
  const company = profile?.companies;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: BG, fontFamily: "'DM Sans', sans-serif" }}>
      <Sidebar
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        profile={profile}
        company={company}
        onSignOut={handleSignOut}
      />
      <div style={{ flex: 1, overflow: 'auto', minWidth: 0 }}>
        {activeTool === 'mom'     && <MomTool profile={profile} company={company} onGoToProfile={() => setActiveTool('profile')} />}
        {activeTool === 'profile' && <ProfilePage profile={profile} company={company} onProfileUpdate={setProfile} userId={session.user.id} />}
        {activeTool === 'team'    && <ProfilePage profile={profile} company={company} onProfileUpdate={setProfile} userId={session.user.id} defaultTab="team" />}
        {!['mom','profile','team'].includes(activeTool) && (
          <ToolsHub toolId={activeTool} tools={TOOLS} />
        )}
      </div>
    </div>
  );
}
