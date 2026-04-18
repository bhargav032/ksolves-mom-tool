import { useState, useEffect, useCallback, useRef } from 'react';
import { R, DK, GR, BD, LR, MID, BG, CATS, STATS, SC, SB, blankMoM, uid } from '../lib/constants';
import { getMoMs, saveMoM, deleteMoM, updateActionStatus } from '../lib/supabase';
import { genFromTranscript, getSuggestions } from '../lib/ai';
import { exportPDF } from '../lib/pdf';

// ─── Shared UI ───────────────────────────────────────────────────────────────
function Btn({ onClick, title, bg, c, children }) {
  return (
    <button onClick={onClick} title={title} style={{ background: bg, color: c, border: 'none', borderRadius: 6, width: 30, height: 30, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {children}
    </button>
  );
}

function SH({ t }) {
  return <div style={{ background: '#f0f0f0', borderLeft: `4px solid ${R}`, padding: '7px 14px', fontWeight: 700, fontSize: 12, color: DK, textTransform: 'uppercase', letterSpacing: .5 }}>{t}</div>;
}

function Toast({ msg }) {
  if (!msg) return null;
  return <div style={{ position: 'fixed', top: 16, right: 16, background: DK, color: '#fff', borderLeft: `4px solid ${R}`, padding: '10px 18px', borderRadius: 8, zIndex: 9999, fontWeight: 600, fontSize: 13, boxShadow: '0 4px 16px rgba(0,0,0,0.3)', animation: 'fadeIn .2s' }}>{msg}</div>;
}

function NoKeyBanner({ onGoToProfile }) {
  return (
    <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
      <span style={{ fontSize: 20 }}>🔑</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: '#92400e' }}>Claude API key not connected</div>
        <div style={{ fontSize: 12, color: '#b45309', marginTop: 2 }}>Connect your key in Profile → Integrations to use AI features.</div>
      </div>
      <button onClick={onGoToProfile} style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 7, padding: '6px 14px', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
        Connect →
      </button>
    </div>
  );
}

// ─── MoM Form ─────────────────────────────────────────────────────────────────
function MoMForm({ initial, userId, companyId, apiKey, onSave, onCancel, onGoToProfile }) {
  const [mom, setMom] = useState(initial || blankMoM(userId));
  const [mode, setMode] = useState('manual');
  const [tr, setTr] = useState('');
  const [aiLoad, setAiLoad] = useState(false);
  const [aiErr, setAiErr] = useState('');
  const [drag, setDrag] = useState(false);
  const [sugg, setSugg] = useState([]);
  const sRef = useRef(null);

  const set = (k, v) => setMom(m => ({ ...m, [k]: v }));
  const addRow = (k, b) => set(k, [...mom[k], { ...b, id: uid() }]);
  const rmRow = (k, id) => set(k, mom[k].filter(r => r.id !== id));
  const upRow = (k, id, f, v) => set(k, mom[k].map(r => r.id === id ? { ...r, [f]: v } : r));

  useEffect(() => {
    if (!apiKey || (!mom.title && !mom.client)) return;
    clearTimeout(sRef.current);
    sRef.current = setTimeout(async () => {
      const s = await getSuggestions(mom, apiKey).catch(() => []);
      setSugg(s);
    }, 2000);
    return () => clearTimeout(sRef.current);
  }, [mom.title, mom.client, apiKey]);

  async function handleFile(file) {
    if (!file) return;
    setAiErr('');
    const n = file.name.toLowerCase();
    if (file.type === 'text/plain' || n.endsWith('.txt') || n.endsWith('.md')) {
      const reader = new FileReader();
      reader.onload = e => setTr(e.target.result);
      reader.readAsText(file); return;
    }
    if (n.endsWith('.docx')) {
      try {
        const mammoth = await import('mammoth');
        const ab = await file.arrayBuffer();
        const res = await mammoth.extractRawText({ arrayBuffer: ab });
        if (res.value.trim()) setTr(res.value); else setAiErr('DOCX appears empty.');
      } catch { setAiErr('Could not read DOCX file.'); }
      return;
    }
    if (n.endsWith('.pdf') || file.type === 'application/pdf') {
      try {
        if (!window.pdfjsLib) {
          await new Promise((res, rej) => {
            const s = document.createElement('script');
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            s.onload = res; s.onerror = rej; document.head.appendChild(s);
          });
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }
        const ab = await file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({ data: ab }).promise;
        let txt = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const pg = await pdf.getPage(i);
          const c = await pg.getTextContent();
          txt += c.items.map(x => x.str).join(' ') + '\n';
        }
        if (txt.trim()) setTr(txt.trim()); else setAiErr('PDF appears empty or scanned.');
      } catch { setAiErr('Could not read PDF.'); }
      return;
    }
    setAiErr('Unsupported format. Use .txt .md .docx or .pdf');
  }

  async function generate() {
    if (!tr.trim()) { setAiErr('Please paste or upload a transcript.'); return; }
    if (!apiKey) { setAiErr('No Claude API key connected. Please add one in Profile → Integrations.'); return; }
    setAiLoad(true); setAiErr('');
    try {
      const g = await genFromTranscript(tr, apiKey);
      setMom(m => ({ ...m, ...g }));
      setMode('manual');
    } catch (e) {
      if (e.message === 'NO_KEY') setAiErr('No API key. Go to Profile → Integrations.');
      else if (e.message === 'INVALID_KEY') setAiErr('Invalid API key. Please check in Profile → Integrations.');
      else setAiErr('Generation failed: ' + e.message);
    }
    setAiLoad(false);
  }

  const iS = { border: `1px solid ${BD}`, borderRadius: 7, padding: '8px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' };
  const lS = { fontSize: 11, fontWeight: 700, color: GR, marginBottom: 4, display: 'block', textTransform: 'uppercase', letterSpacing: .4 };

  return (
    <div style={{ fontFamily: 'inherit', minHeight: '100vh', background: BG }}>
      {/* Header */}
      <div style={{ background: DK, color: '#fff', padding: '0 20px', height: 52, display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 100 }}>
        <button onClick={onCancel} style={{ background: 'transparent', border: '1px solid #555', color: '#ccc', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>← Back</button>
        <span style={{ fontWeight: 700, fontSize: 15 }}>{initial && !initial._new ? 'Edit MoM' : 'New MoM'}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={() => { setMode(m => m === 'transcript' ? 'manual' : 'transcript'); setAiErr(''); }}
            style={{ background: mode === 'transcript' ? '#7c3aed' : '#333', border: 'none', color: '#fff', borderRadius: 6, padding: '5px 14px', cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'inherit' }}>
            ✨ {mode === 'transcript' ? 'Hide AI' : 'Generate from Transcript'}
          </button>
          <button onClick={() => onSave(mom)} style={{ background: R, border: 'none', color: '#fff', borderRadius: 6, padding: '5px 18px', fontWeight: 700, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>💾 Save</button>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 16px' }}>
        {!apiKey && <NoKeyBanner onGoToProfile={onGoToProfile} />}

        {sugg.length > 0 && (
          <div style={{ background: 'linear-gradient(135deg,#7c3aed11,#E8192C11)', border: '1px solid #e0d0ff', borderRadius: 10, padding: '10px 16px', marginBottom: 16, display: 'flex', gap: 10 }}>
            <span style={{ color: '#7c3aed', fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap', marginTop: 2 }}>✨ AI:</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {sugg.map((s, i) => <span key={i} style={{ background: '#fff', border: '1px solid #d4b8ff', borderRadius: 14, padding: '3px 11px', fontSize: 12, color: GR }}>{s}</span>)}
            </div>
          </div>
        )}

        {/* Transcript Panel */}
        {mode === 'transcript' && (
          <div style={{ background: '#fff', borderRadius: 12, border: '2px solid #7c3aed', overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ background: 'linear-gradient(135deg,#7c3aed,#5b21b6)', padding: '12px 18px' }}>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>✨ AI MoM Generator</div>
              <div style={{ color: '#c4b5fd', fontSize: 11, marginTop: 2 }}>Paste or upload your transcript — AI auto-fills everything</div>
            </div>
            <div style={{ padding: 18 }}>
              {!apiKey && (
                <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#92400e', display: 'flex', alignItems: 'center', gap: 8 }}>
                  🔑 <span>Connect your Claude API key in <strong>Profile → Integrations</strong> to use this feature.</span>
                </div>
              )}
              <div
                onDragOver={e => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={e => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]); }}
                onClick={() => document.getElementById('tfile').click()}
                style={{ border: `2px dashed ${drag ? '#7c3aed' : '#d4b8ff'}`, borderRadius: 10, padding: 16, textAlign: 'center', background: drag ? '#f5f0ff' : '#faf7ff', marginBottom: 12, cursor: 'pointer' }}>
                <div style={{ fontSize: 24, marginBottom: 4 }}>📄</div>
                <div style={{ fontWeight: 600, color: '#7c3aed', fontSize: 13 }}>Drop file or click to upload</div>
                <div style={{ display: 'flex', gap: 5, justifyContent: 'center', marginTop: 6, flexWrap: 'wrap' }}>
                  {['.docx', '.pdf', '.txt', '.md'].map(x => <span key={x} style={{ background: '#ede9fe', color: '#7c3aed', borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>{x}</span>)}
                </div>
                <input id="tfile" type="file" accept=".txt,.md,.docx,.pdf" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
              </div>
              <textarea value={tr} onChange={e => setTr(e.target.value)}
                placeholder={"Paste your meeting transcript here…\n\nExample:\nJohn (PM): Let's review the project scope.\nSarah (Client): We need delivery by end of month.\nJohn: Noted. I'll share the updated timeline by Friday."}
                style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #d4b8ff', borderRadius: 8, padding: 12, fontSize: 12, minHeight: 140, resize: 'vertical', fontFamily: 'DM Mono, monospace', outline: 'none', background: '#faf7ff' }} />
              {tr && <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>📝 {tr.split(/\s+/).filter(Boolean).length} words</div>}
              {aiErr && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '9px 12px', marginTop: 10, color: '#dc2626', fontSize: 12 }}>⚠️ {aiErr}</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button onClick={generate} disabled={aiLoad || !tr.trim() || !apiKey}
                  style={{ background: !apiKey ? '#ccc' : aiLoad ? '#9a72d4' : '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 24px', fontWeight: 700, fontSize: 13, cursor: aiLoad || !apiKey ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {aiLoad ? <><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', borderRadius: '50%', width: 12, height: 12, border: '2px solid #fff', borderTopColor: 'transparent' }} />Generating…</> : '✨ Generate MoM'}
                </button>
                {tr && <button onClick={() => { setTr(''); setAiErr(''); }} style={{ background: '#f5f5f5', border: `1px solid ${BD}`, borderRadius: 8, padding: '9px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Clear</button>}
              </div>
            </div>
          </div>
        )}

        {/* Meeting Details */}
        <div style={{ background: '#fff', borderRadius: 10, border: `1px solid ${BD}`, overflow: 'hidden', marginBottom: 14 }}>
          <SH t="📋 Meeting Details" />
          <div style={{ padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1/-1' }}><label style={lS}>Meeting Title *</label><input style={iS} value={mom.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Q2 Project Kickoff – ABC Corp" /></div>
            <div><label style={lS}>Client</label><input style={iS} value={mom.client} onChange={e => set('client', e.target.value)} placeholder="e.g. ABC Technologies" /></div>
            <div><label style={lS}>Category</label>
              <select style={iS} value={mom.category} onChange={e => set('category', e.target.value)}>
                <option value="">Select…</option>
                {CATS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div><label style={lS}>Date</label><input type="date" style={iS} value={mom.date} onChange={e => set('date', e.target.value)} /></div>
            <div><label style={lS}>Time</label><input style={iS} value={mom.time} onChange={e => set('time', e.target.value)} placeholder="e.g. 3:00 PM IST" /></div>
            <div><label style={lS}>Platform</label><input style={iS} value={mom.platform} onChange={e => set('platform', e.target.value)} placeholder="e.g. Google Meet" /></div>
            <div><label style={lS}>Location</label><input style={iS} value={mom.location} onChange={e => set('location', e.target.value)} placeholder="e.g. Online / Room A" /></div>
          </div>
        </div>

        {/* Agenda */}
        <div style={{ background: '#fff', borderRadius: 10, border: `1px solid ${BD}`, overflow: 'hidden', marginBottom: 14 }}>
          <SH t="📌 Agenda" />
          <div style={{ padding: 16 }}>
            {mom.agenda.map((ag, i) => (
              <div key={i} style={{ display: 'flex', gap: 7, marginBottom: 7 }}>
                <span style={{ paddingTop: 9, color: R, fontWeight: 700, minWidth: 20 }}>{i + 1}.</span>
                <input style={{ ...iS, flex: 1 }} value={ag} onChange={e => { const a = [...mom.agenda]; a[i] = e.target.value; set('agenda', a); }} placeholder="Agenda item" />
                {mom.agenda.length > 1 && <button onClick={() => set('agenda', mom.agenda.filter((_, j) => j !== i))} style={{ color: R, background: LR, border: 'none', borderRadius: 5, width: 28, cursor: 'pointer' }}>×</button>}
              </div>
            ))}
            <button onClick={() => set('agenda', [...mom.agenda, ''])} style={{ background: LR, color: R, border: `1px dashed ${R}`, borderRadius: 6, padding: '5px 14px', cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'inherit' }}>+ Add Item</button>
          </div>
        </div>

        {/* Attendees */}
        <div style={{ background: '#fff', borderRadius: 10, border: `1px solid ${BD}`, overflow: 'hidden', marginBottom: 14 }}>
          <SH t="👥 Attendees" />
          <div style={{ padding: 16, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9f9f9' }}>
                  {['#', 'Name', 'Org', 'Role', 'Present', ''].map(h => <th key={h} style={{ padding: '7px 8px', textAlign: 'left', fontWeight: 700, color: GR, borderBottom: `2px solid ${R}`, fontSize: 11, textTransform: 'uppercase' }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {mom.attendees.map((a, i) => (
                  <tr key={a.id}>
                    <td style={{ padding: '5px 8px', color: '#888', fontSize: 12 }}>{i + 1}</td>
                    {[['name', 'Full Name'], ['org', 'Company'], ['role', 'Role']].map(([f, ph]) => (
                      <td key={f} style={{ padding: '4px 5px' }}><input style={{ ...iS, minWidth: 90 }} value={a[f] || ''} onChange={e => upRow('attendees', a.id, f, e.target.value)} placeholder={ph} /></td>
                    ))}
                    <td style={{ padding: '4px 8px' }}><input type="checkbox" checked={a.present} onChange={e => upRow('attendees', a.id, 'present', e.target.checked)} style={{ width: 15, height: 15, accentColor: R }} /></td>
                    <td>{mom.attendees.length > 1 && <button onClick={() => rmRow('attendees', a.id)} style={{ color: R, background: LR, border: 'none', borderRadius: 4, width: 24, height: 24, cursor: 'pointer' }}>×</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button onClick={() => addRow('attendees', { name: '', org: '', role: '', present: true })} style={{ marginTop: 8, background: LR, color: R, border: `1px dashed ${R}`, borderRadius: 6, padding: '5px 14px', cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'inherit' }}>+ Add Attendee</button>
          </div>
        </div>

        {/* Discussions */}
        <div style={{ background: '#fff', borderRadius: 10, border: `1px solid ${BD}`, overflow: 'hidden', marginBottom: 14 }}>
          <SH t="💬 Discussion Points" />
          <div style={{ padding: 16, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9f9f9' }}>
                  {['#', 'Topic', 'Details', 'Owner', ''].map(h => <th key={h} style={{ padding: '7px 8px', textAlign: 'left', fontWeight: 700, color: GR, borderBottom: `2px solid ${R}`, fontSize: 11, textTransform: 'uppercase' }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {mom.discussions.map((d, i) => (
                  <tr key={d.id} style={{ borderBottom: `1px solid #f5f5f5` }}>
                    <td style={{ padding: '5px 8px', color: '#888', fontSize: 12 }}>{i + 1}</td>
                    <td style={{ padding: '3px 5px' }}><input style={{ ...iS, minWidth: 110 }} value={d.topic || ''} onChange={e => upRow('discussions', d.id, 'topic', e.target.value)} placeholder="Topic" /></td>
                    <td style={{ padding: '3px 5px' }}><textarea style={{ ...iS, minWidth: 180, minHeight: 48, resize: 'vertical' }} value={d.details || ''} onChange={e => upRow('discussions', d.id, 'details', e.target.value)} placeholder="Details and decisions…" /></td>
                    <td style={{ padding: '3px 5px' }}><input style={{ ...iS, minWidth: 90 }} value={d.owner || ''} onChange={e => upRow('discussions', d.id, 'owner', e.target.value)} placeholder="Owner" /></td>
                    <td>{mom.discussions.length > 1 && <button onClick={() => rmRow('discussions', d.id)} style={{ color: R, background: LR, border: 'none', borderRadius: 4, width: 24, height: 24, cursor: 'pointer' }}>×</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button onClick={() => addRow('discussions', { topic: '', details: '', owner: '' })} style={{ marginTop: 8, background: LR, color: R, border: `1px dashed ${R}`, borderRadius: 6, padding: '5px 14px', cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'inherit' }}>+ Add Point</button>
          </div>
        </div>

        {/* Action Items */}
        <div style={{ background: '#fff', borderRadius: 10, border: `1px solid ${BD}`, overflow: 'hidden', marginBottom: 14 }}>
          <SH t="✅ Action Items" />
          <div style={{ padding: 16, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9f9f9' }}>
                  {['#', 'Action', 'Owner', 'Team', 'Deadline', 'Status', ''].map(h => <th key={h} style={{ padding: '7px 8px', textAlign: 'left', fontWeight: 700, color: GR, borderBottom: `2px solid ${R}`, fontSize: 11, textTransform: 'uppercase' }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {mom.actionItems.map((a, i) => (
                  <tr key={a.id} style={{ borderBottom: `1px solid #f5f5f5` }}>
                    <td style={{ padding: '5px 8px', color: '#888', fontSize: 12 }}>{i + 1}</td>
                    <td style={{ padding: '3px 5px' }}><textarea style={{ ...iS, minWidth: 150, minHeight: 42, resize: 'vertical' }} value={a.action || ''} onChange={e => upRow('actionItems', a.id, 'action', e.target.value)} placeholder="Action description" /></td>
                    <td style={{ padding: '3px 5px' }}><input style={{ ...iS, minWidth: 90 }} value={a.owner || ''} onChange={e => upRow('actionItems', a.id, 'owner', e.target.value)} placeholder="Owner" /></td>
                    <td style={{ padding: '3px 5px' }}><input style={{ ...iS, minWidth: 90 }} value={a.team || ''} onChange={e => upRow('actionItems', a.id, 'team', e.target.value)} placeholder="Team" /></td>
                    <td style={{ padding: '3px 5px' }}><input type="date" style={{ ...iS, minWidth: 120 }} value={a.deadline || ''} onChange={e => upRow('actionItems', a.id, 'deadline', e.target.value)} /></td>
                    <td style={{ padding: '3px 5px' }}>
                      <select style={{ ...iS, minWidth: 105, color: SC[a.status], fontWeight: 700 }} value={a.status} onChange={e => upRow('actionItems', a.id, 'status', e.target.value)}>
                        {STATS.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </td>
                    <td>{mom.actionItems.length > 1 && <button onClick={() => rmRow('actionItems', a.id)} style={{ color: R, background: LR, border: 'none', borderRadius: 4, width: 24, height: 24, cursor: 'pointer' }}>×</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button onClick={() => addRow('actionItems', { action: '', owner: '', deadline: '', status: 'Open', team: '' })} style={{ marginTop: 8, background: LR, color: R, border: `1px dashed ${R}`, borderRadius: 6, padding: '5px 14px', cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'inherit' }}>+ Add Action</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingBottom: 20 }}>
          <button onClick={onCancel} style={{ border: `1px solid ${BD}`, background: '#fff', borderRadius: 8, padding: '9px 22px', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>Cancel</button>
          <button onClick={() => onSave(mom)} style={{ background: R, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 26px', fontWeight: 700, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>💾 Save MoM</button>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ─── MoM Preview ──────────────────────────────────────────────────────────────
function MoMPreview({ mom, onBack, onEdit }) {
  const thS = { background: '#f0f0f0', padding: '7px 11px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', borderBottom: `2px solid ${R}`, color: DK };
  const tdS = { padding: '7px 11px', borderBottom: `1px solid ${BD}`, fontSize: 13, verticalAlign: 'top' };
  const teams = [...new Set(mom.actionItems.map(a => a.team || 'General'))];

  return (
    <div style={{ fontFamily: 'inherit', minHeight: '100vh', background: '#f0f0f0' }}>
      <div style={{ background: DK, color: '#fff', padding: '0 20px', height: 52, display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 100 }}>
        <button onClick={onBack} style={{ background: 'transparent', border: '1px solid #555', color: '#ccc', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>← Back</button>
        <span style={{ fontWeight: 700, fontSize: 15 }}>MoM Preview</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={() => exportPDF(mom)} style={{ background: R, border: 'none', color: '#fff', borderRadius: 6, padding: '5px 16px', fontWeight: 700, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>⬇ Download PDF</button>
          <button onClick={onEdit} style={{ background: '#555', border: 'none', color: '#fff', borderRadius: 6, padding: '5px 16px', fontWeight: 700, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>✏️ Edit</button>
        </div>
      </div>
      <div style={{ maxWidth: 880, margin: '20px auto', padding: '0 16px 40px' }}>
        <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}>
          <div style={{ padding: '18px 26px', borderBottom: `4px solid ${R}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: '#fafafa' }}>
            <div><span style={{ color: R, fontWeight: 900, fontSize: 20 }}>KSOLVES</span><br /><span style={{ color: '#aaa', fontSize: 9, letterSpacing: 2 }}>EMERGING AHEAD ALWAYS</span></div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: DK }}>Minutes of Meeting</div>
              <div style={{ color: GR, fontSize: 12, marginTop: 3 }}>{mom.date}</div>
              {mom.category && <div style={{ background: R, color: '#fff', borderRadius: 4, padding: '2px 9px', fontSize: 11, fontWeight: 700, marginTop: 5, display: 'inline-block' }}>{mom.category}</div>}
            </div>
          </div>
          <div style={{ background: LR, borderLeft: `4px solid ${R}`, padding: '9px 26px' }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: DK }}>{mom.title || 'Untitled MoM'}</span>
          </div>
          <div style={{ padding: '0 26px 26px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 18, border: `1px solid ${BD}` }}>
              <tbody>
                <tr><td style={{ ...tdS, background: '#f9f9f9', fontWeight: 700, width: '18%' }}>Client</td><td style={tdS}>{mom.client || '—'}</td><td style={{ ...tdS, background: '#f9f9f9', fontWeight: 700, width: '18%' }}>Date</td><td style={tdS}>{mom.date}</td></tr>
                <tr><td style={{ ...tdS, background: '#f9f9f9', fontWeight: 700 }}>Time</td><td style={tdS}>{mom.time || '—'}</td><td style={{ ...tdS, background: '#f9f9f9', fontWeight: 700 }}>Platform</td><td style={tdS}>{mom.platform || '—'}</td></tr>
              </tbody>
            </table>
            {mom.agenda.some(a => a) && (
              <div><div style={{ background: '#f0f0f0', borderLeft: `4px solid ${R}`, padding: '5px 12px', fontWeight: 700, fontSize: 12, marginTop: 18, color: DK, textTransform: 'uppercase' }}>📌 Agenda</div>
                <div style={{ border: `1px solid ${BD}`, borderTop: 'none', padding: '9px 14px' }}>
                  {mom.agenda.filter(Boolean).map((ag, i) => <div key={i} style={{ fontSize: 13, padding: '2px 0', color: GR }}><span style={{ color: R, fontWeight: 700, marginRight: 7 }}>{i + 1}.</span>{ag}</div>)}
                </div>
              </div>
            )}
            <div style={{ background: '#f0f0f0', borderLeft: `4px solid ${R}`, padding: '5px 12px', fontWeight: 700, fontSize: 12, marginTop: 18, color: DK, textTransform: 'uppercase' }}>👥 Attendees</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: `1px solid ${BD}`, borderTop: 'none' }}>
              <thead><tr>{['S.No', 'Name', 'Organization', 'Role', 'Status'].map(h => <th key={h} style={thS}>{h}</th>)}</tr></thead>
              <tbody>
                {mom.attendees.map((a, i) => (
                  <tr key={a.id || i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={tdS}>{i + 1}</td><td style={{ ...tdS, fontWeight: 600 }}>{a.name || '—'}</td>
                    <td style={tdS}>{a.org || '—'}</td><td style={tdS}>{a.role || '—'}</td>
                    <td style={tdS}><span style={{ background: a.present ? '#dcfce7' : '#fee2e2', color: a.present ? '#16a34a' : R, borderRadius: 4, padding: '2px 7px', fontWeight: 700, fontSize: 12 }}>{a.present ? '✓ Present' : '✗ Absent'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {mom.discussions.some(d => d.topic) && (
              <div>
                <div style={{ background: '#f0f0f0', borderLeft: `4px solid ${R}`, padding: '5px 12px', fontWeight: 700, fontSize: 12, marginTop: 18, color: DK, textTransform: 'uppercase' }}>💬 Discussion Points</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', border: `1px solid ${BD}`, borderTop: 'none' }}>
                  <thead><tr>{['No.', 'Topic', 'Details', 'Owner'].map(h => <th key={h} style={thS}>{h}</th>)}</tr></thead>
                  <tbody>
                    {mom.discussions.filter(d => d.topic).map((d, i) => (
                      <tr key={d.id || i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                        <td style={{ ...tdS, color: R, fontWeight: 700, width: 36 }}>{i + 1}</td>
                        <td style={{ ...tdS, fontWeight: 600, width: '22%' }}>{d.topic}</td>
                        <td style={tdS}>{d.details}</td><td style={{ ...tdS, width: '15%' }}>{d.owner}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {mom.actionItems.some(a => a.action) && (
              <div>
                <div style={{ background: '#f0f0f0', borderLeft: `4px solid ${R}`, padding: '5px 12px', fontWeight: 700, fontSize: 12, marginTop: 18, color: DK, textTransform: 'uppercase' }}>✅ Action Items</div>
                {teams.map(team => {
                  const items = mom.actionItems.filter(a => (a.team || 'General') === team && a.action);
                  if (!items.length) return null;
                  return (
                    <div key={team}>
                      {teams.length > 1 && <div style={{ background: LR, color: R, padding: '5px 12px', fontWeight: 700, fontSize: 12, border: `1px solid ${BD}`, borderTop: 'none' }}>Action Items — {team}:</div>}
                      <table style={{ width: '100%', borderCollapse: 'collapse', border: `1px solid ${BD}`, borderTop: 'none' }}>
                        <thead><tr>{['#', 'Action', 'Owner', 'Deadline', 'Status'].map(h => <th key={h} style={thS}>{h}</th>)}</tr></thead>
                        <tbody>
                          {items.map((a, i) => (
                            <tr key={a.id || i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                              <td style={{ ...tdS, color: R, fontWeight: 700 }}>•</td>
                              <td style={tdS}>{a.action}</td><td style={{ ...tdS, width: '14%' }}>{a.owner}</td>
                              <td style={{ ...tdS, width: '12%' }}>{a.deadline || '—'}</td>
                              <td style={{ ...tdS, width: 110 }}><span style={{ background: SB[a.status], color: SC[a.status], borderRadius: 4, padding: '2px 8px', fontWeight: 700, fontSize: 12 }}>{a.status}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{ marginTop: 24, paddingTop: 12, borderTop: `2px solid ${R}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <em style={{ fontSize: 12, color: GR }}>Please let us know if you wish to add or edit anything.</em>
              <div style={{ textAlign: 'right', fontSize: 12 }}><div style={{ fontWeight: 700, color: DK }}>Thanks &amp; Regards,</div><div style={{ color: R, fontWeight: 700 }}>Ksolves Team</div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Analytics ────────────────────────────────────────────────────────────────
function Analytics({ moms, allActs, updStatus }) {
  const clients = [...new Set(moms.map(m => m.client).filter(Boolean))];
  const byS = STATS.map(s => ({ label: s, count: allActs.filter(a => a.status === s).length }));
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1); return { label: d.toLocaleString('default', { month: 'short' }), y: d.getFullYear(), m: d.getMonth() }; });
  const monthly = months.map(mo => ({ label: mo.label, n: moms.filter(x => { const d = new Date(x.date); return d.getFullYear() === mo.y && d.getMonth() === mo.m; }).length }));
  const maxM = Math.max(...monthly.map(m => m.n), 1);
  const maxC = Math.max(...clients.map(c => moms.filter(m => m.client === c).length), 1);
  const done = allActs.filter(a => a.status === 'Done').length;
  const today = new Date().toISOString().slice(0, 10);

  const kpis = [
    { label: 'Total MoMs', val: moms.length, icon: '📋', color: '#1a73e8' },
    { label: 'Clients', val: clients.length, icon: '🏢', color: '#7c3aed' },
    { label: 'Total Actions', val: allActs.length, icon: '✅', color: GR },
    { label: 'Open', val: allActs.filter(a => a.status === 'Open').length, icon: '🔵', color: '#1a73e8' },
    { label: 'In Progress', val: allActs.filter(a => a.status === 'In Progress').length, icon: '🟡', color: '#d97706' },
    { label: 'Done', val: done, icon: '🟢', color: '#16a34a' },
    { label: 'Overdue', val: allActs.filter(a => a.status === 'Overdue').length, icon: '🔴', color: R },
  ];

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: DK, marginBottom: 20 }}>📊 Analytics</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10, marginBottom: 20 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ background: '#fff', borderRadius: 10, padding: '14px 16px', border: `1px solid ${BD}`, borderTop: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 18 }}>{k.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color, marginTop: 3 }}>{k.val}</div>
            <div style={{ fontSize: 10, color: '#888', marginTop: 2, textTransform: 'uppercase' }}>{k.label}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <div style={{ background: '#fff', borderRadius: 10, padding: 18, border: `1px solid ${BD}` }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: DK, marginBottom: 14 }}>🏢 MoMs by Client</div>
          {clients.length === 0 ? <div style={{ color: '#aaa', fontSize: 13 }}>No data yet.</div> :
            clients.sort((a, b) => moms.filter(m => m.client === b).length - moms.filter(m => m.client === a).length).map(c => {
              const cnt = moms.filter(m => m.client === c).length;
              return (
                <div key={c} style={{ marginBottom: 9 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 3 }}><span style={{ fontWeight: 600, color: DK }}>{c}</span><span style={{ color: R, fontWeight: 700 }}>{cnt}</span></div>
                  <div style={{ background: '#f0f0f0', borderRadius: 4, height: 7 }}><div style={{ background: R, borderRadius: 4, height: 7, width: (cnt / maxC * 100) + '%' }} /></div>
                </div>
              );
            })}
        </div>
        <div style={{ background: '#fff', borderRadius: 10, padding: 18, border: `1px solid ${BD}` }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: DK, marginBottom: 14 }}>📈 Action Status</div>
          {byS.map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
              <div style={{ minWidth: 80, fontSize: 12, fontWeight: 600, color: DK }}>{item.label}</div>
              <div style={{ flex: 1, background: '#f0f0f0', borderRadius: 5, height: 12 }}>
                <div style={{ background: SC[item.label], borderRadius: 5, height: 12, width: (allActs.length ? item.count / allActs.length * 100 : 0) + '%' }} />
              </div>
              <span style={{ fontWeight: 700, color: SC[item.label], minWidth: 22, textAlign: 'right' }}>{item.count}</span>
            </div>
          ))}
          {allActs.length > 0 && (
            <div style={{ marginTop: 14, padding: '10px 12px', background: '#f9f9f9', borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 5, fontWeight: 600, textTransform: 'uppercase' }}>Completion Rate</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={{ flex: 1, background: '#f0f0f0', borderRadius: 5, height: 10 }}><div style={{ background: '#16a34a', borderRadius: 5, height: 10, width: (done / allActs.length * 100) + '%' }} /></div>
                <span style={{ fontWeight: 800, color: '#16a34a' }}>{Math.round(done / allActs.length * 100)}%</span>
              </div>
            </div>
          )}
        </div>
      </div>
      <div style={{ background: '#fff', borderRadius: 10, padding: 18, border: `1px solid ${BD}` }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: DK, marginBottom: 18 }}>📅 MoM Activity — Last 6 Months</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 150 }}>
          {monthly.map((m, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: m.n > 0 ? R : '#ccc' }}>{m.n || ''}</span>
              <div style={{ width: '100%', borderRadius: '4px 4px 0 0', height: Math.max((m.n / maxM) * 120, m.n > 0 ? 8 : 2), background: m.n > 0 ? R : '#eee' }} />
              <span style={{ fontSize: 11, color: '#888', fontWeight: 600 }}>{m.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Action Tracker ───────────────────────────────────────────────────────────
function ActionTracker({ allActs, updStatus }) {
  const [fo, setFo] = useState(''); const [fSt, setFSt] = useState(''); const [fc, setFc] = useState('');
  const owners = [...new Set(allActs.map(a => a.owner).filter(Boolean))];
  const clients = [...new Set(allActs.map(a => a.client).filter(Boolean))];
  const today = new Date().toISOString().slice(0, 10);
  const filtered = allActs.filter(a => (!fo || a.owner === fo) && (!fSt || a.status === fSt) && (!fc || a.client === fc))
    .sort((a, b) => (a.deadline || '9') < (b.deadline || '9') ? -1 : 1);

  const sel = { border: `1px solid ${BD}`, borderRadius: 6, padding: '6px 9px', fontSize: 13, fontFamily: 'inherit', outline: 'none' };
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', background: '#fff', padding: 13, borderRadius: 10, border: `1px solid ${BD}`, alignItems: 'center' }}>
        <select value={fo} onChange={e => setFo(e.target.value)} style={sel}><option value="">All Owners</option>{owners.map(o => <option key={o}>{o}</option>)}</select>
        <select value={fSt} onChange={e => setFSt(e.target.value)} style={sel}><option value="">All Statuses</option>{STATS.map(s => <option key={s}>{s}</option>)}</select>
        <select value={fc} onChange={e => setFc(e.target.value)} style={sel}><option value="">All Clients</option>{clients.map(c => <option key={c}>{c}</option>)}</select>
        {(fo || fSt || fc) && <button onClick={() => { setFo(''); setFSt(''); setFc(''); }} style={{ border: `1px solid ${R}`, color: R, background: LR, borderRadius: 6, padding: '6px 11px', fontSize: 12, cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit' }}>✕ Clear</button>}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#888' }}>{filtered.length} item{filtered.length !== 1 ? 's' : ''}</span>
      </div>
      {filtered.length === 0
        ? <div style={{ textAlign: 'center', color: '#aaa', padding: 36, background: '#fff', borderRadius: 10 }}>No action items found.</div>
        : <div style={{ background: '#fff', borderRadius: 10, overflow: 'hidden', border: `1px solid ${BD}` }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: '#f0f0f0' }}>{['Action', 'Owner', 'Client', 'MoM', 'Deadline', 'Status'].map(h => <th key={h} style={{ padding: '9px 11px', textAlign: 'left', color: DK, fontWeight: 700, fontSize: 11, textTransform: 'uppercase', borderBottom: `2px solid ${R}` }}>{h}</th>)}</tr></thead>
            <tbody>
              {filtered.map((a, i) => (
                <tr key={a.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa', borderBottom: `1px solid #f0f0f0` }}>
                  <td style={{ padding: '8px 11px', maxWidth: 220 }}>{a.action}</td>
                  <td style={{ padding: '8px 11px', fontWeight: 600 }}>{a.owner || '—'}</td>
                  <td style={{ padding: '8px 11px' }}>{a.client || '—'}</td>
                  <td style={{ padding: '8px 11px', color: '#888', fontSize: 12 }}>{a.momTitle}</td>
                  <td style={{ padding: '8px 11px', color: a.deadline && a.deadline < today && a.status !== 'Done' ? R : '#444' }}>{a.deadline || '—'}</td>
                  <td style={{ padding: '8px 11px' }}>
                    <select value={a.status} onChange={e => updStatus(a.momId, a.id, e.target.value)} style={{ border: `1px solid ${BD}`, borderRadius: 5, padding: '3px 7px', fontSize: 12, color: SC[a.status], fontWeight: 700, background: SB[a.status], cursor: 'pointer', fontFamily: 'inherit' }}>
                      {STATS.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>}
    </div>
  );
}

// ─── MoM Tool (main page) ────────────────────────────────────────────────────
export default function MomTool({ profile, company, onGoToProfile }) {
  const [moms, setMoms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('tracker'); // tracker | create | edit | preview
  const [editM, setEditM] = useState(null);
  const [prevM, setPrevM] = useState(null);
  const [tab, setTab] = useState('moms'); // moms | actions
  const [mainTab, setMainTab] = useState('tracker'); // tracker | analytics
  const [fCl, setFCl] = useState(''); const [fCa, setFCa] = useState(''); const [fSt, setFSt] = useState('');
  const [sortBy, setSortBy] = useState('date_desc');
  const [toast, setToast] = useState('');

  const apiKey = profile?.claude_api_key;
  const userId = profile?.id;
  const companyId = company?.id;

  function showToast(m) { setToast(m); setTimeout(() => setToast(''), 3000); }

  useEffect(() => {
    if (!companyId) return;
    getMoMs(companyId).then(setMoms).finally(() => setLoading(false));
  }, [companyId]);

  const persist = useCallback(async (mom) => {
    try {
      const saved = await saveMoM(mom, userId, companyId);
      setMoms(prev => prev.some(x => x.id === saved.id) ? prev.map(x => x.id === saved.id ? saved : x) : [saved, ...prev]);
      return saved;
    } catch (e) { showToast('⚠ Save failed: ' + e.message); throw e; }
  }, [userId, companyId]);

  async function handleSave(mom) {
    await persist(mom);
    setView('tracker'); showToast('MoM saved ✓');
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this MoM?')) return;
    await deleteMoM(id);
    setMoms(prev => prev.filter(m => m.id !== id));
    showToast('Deleted.');
  }

  async function updStatus(momId, actionId, status) {
    await updateActionStatus(momId, actionId, status);
    setMoms(prev => prev.map(m => m.id === momId ? { ...m, actionItems: m.actionItems.map(a => a.id === actionId ? { ...a, status } : a) } : m));
  }

  if (view === 'create' || view === 'edit') {
    return <MoMForm initial={editM} userId={userId} companyId={companyId} apiKey={apiKey} onSave={handleSave} onCancel={() => setView('tracker')} onGoToProfile={onGoToProfile} />;
  }
  if (view === 'preview' && prevM) {
    return <MoMPreview mom={prevM} onBack={() => setView('tracker')} onEdit={() => { setEditM(prevM); setView('edit'); }} />;
  }

  const filtered = moms.filter(m => {
    if (fCl && !m.client.toLowerCase().includes(fCl.toLowerCase())) return false;
    if (fCa && m.category !== fCa) return false;
    if (fSt && !m.actionItems.some(a => a.status === fSt)) return false;
    return true;
  }).sort((a, b) => {
    if (sortBy === 'date_asc') return new Date(a.date) - new Date(b.date);
    if (sortBy === 'client') return a.client.localeCompare(b.client);
    return new Date(b.date) - new Date(a.date);
  });

  const allActs = moms.flatMap(m => m.actionItems.map(a => ({ ...a, momTitle: m.title, client: m.client, momId: m.id })));

  const sel = { border: `1px solid ${BD}`, borderRadius: 6, padding: '6px 9px', fontSize: 13, fontFamily: 'inherit', outline: 'none' };

  return (
    <div style={{ fontFamily: 'inherit', minHeight: '100vh', background: BG }}>
      <Toast msg={toast} />

      {/* Page header */}
      <div style={{ background: '#fff', borderBottom: `1px solid ${BD}`, padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {[['tracker', '📋 MoMs'], ['analytics', '📊 Analytics']].map(([id, label]) => (
            <button key={id} onClick={() => setMainTab(id)} style={{ padding: '6px 16px', border: 'none', borderBottom: `3px solid ${mainTab === id ? R : 'transparent'}`, background: 'none', color: mainTab === id ? R : GR, fontWeight: mainTab === id ? 700 : 500, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>{label}</button>
          ))}
        </div>
        {!apiKey && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: '5px 12px', cursor: 'pointer' }} onClick={onGoToProfile}>
            <span style={{ fontSize: 13 }}>🔑</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#92400e' }}>Connect Claude API</span>
          </div>
        )}
        <button onClick={() => { setEditM(blankMoM(userId)); setView('create'); }} style={{ background: R, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>+ New MoM</button>
      </div>

      {mainTab === 'analytics' && <Analytics moms={moms} allActs={allActs} updStatus={updStatus} />}

      {mainTab === 'tracker' && (
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 16px' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {[['moms', '📋 All MoMs'], ['actions', '✅ Actions']].map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)} style={{ background: tab === id ? R : '#fff', color: tab === id ? '#fff' : GR, border: `2px solid ${tab === id ? R : BD}`, borderRadius: 8, padding: '7px 18px', fontWeight: 700, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>{label}</button>
            ))}
          </div>

          {tab === 'moms' && (
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', background: '#fff', padding: 14, borderRadius: 10, border: `1px solid ${BD}` }}>
                <input placeholder="🔍 Filter by client" value={fCl} onChange={e => setFCl(e.target.value)} style={{ border: `1px solid ${BD}`, borderRadius: 6, padding: '6px 11px', fontSize: 13, minWidth: 170, fontFamily: 'inherit', outline: 'none' }} />
                <select value={fCa} onChange={e => setFCa(e.target.value)} style={sel}><option value="">All Categories</option>{CATS.map(c => <option key={c}>{c}</option>)}</select>
                <select value={fSt} onChange={e => setFSt(e.target.value)} style={sel}><option value="">All Statuses</option>{STATS.map(s => <option key={s}>{s}</option>)}</select>
                <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={sel}>
                  <option value="date_desc">Newest First</option>
                  <option value="date_asc">Oldest First</option>
                  <option value="client">Client A–Z</option>
                </select>
                {(fCl || fCa || fSt) && <button onClick={() => { setFCl(''); setFCa(''); setFSt(''); }} style={{ border: `1px solid ${R}`, color: R, borderRadius: 6, padding: '6px 11px', fontSize: 13, cursor: 'pointer', background: LR, fontWeight: 700, fontFamily: 'inherit' }}>✕ Clear</button>}
              </div>

              {loading
                ? <div style={{ textAlign: 'center', padding: 48, color: '#aaa', fontSize: 14 }}>Loading MoMs…</div>
                : filtered.length === 0
                  ? (
                    <div style={{ textAlign: 'center', padding: '54px 18px', background: '#fff', borderRadius: 12, border: `2px dashed ${BD}` }}>
                      <div style={{ fontSize: 44, marginBottom: 14 }}>📋</div>
                      <div style={{ fontWeight: 700, fontSize: 17, color: DK, marginBottom: 7 }}>{moms.length === 0 ? 'No MoMs yet' : 'No results'}</div>
                      <div style={{ color: '#888', fontSize: 13, marginBottom: 18 }}>{moms.length === 0 ? 'Create your first Meeting Minutes to get started.' : 'Try adjusting your filters.'}</div>
                      {moms.length === 0 && <button onClick={() => { setEditM(blankMoM(userId)); setView('create'); }} style={{ background: R, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 26px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>+ Create First MoM</button>}
                    </div>
                  )
                  : (
                    <div style={{ display: 'grid', gap: 10 }}>
                      {filtered.map(m => {
                        const done = m.actionItems.filter(a => a.status === 'Done').length;
                        const total = m.actionItems.length;
                        const pct = total ? Math.round(done / total * 100) : 0;
                        return (
                          <div key={m.id} style={{ background: '#fff', borderRadius: 10, border: `1px solid ${BD}`, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                                <span style={{ fontWeight: 700, fontSize: 14, color: DK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title || 'Untitled MoM'}</span>
                                {m.category && <span style={{ background: LR, color: R, borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{m.category}</span>}
                              </div>
                              <div style={{ fontSize: 12, color: '#666', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                                <span>🏢 {m.client || '—'}</span>
                                <span>📅 {m.date}</span>
                                <span>👥 {m.attendees.filter(a => a.present).length}/{m.attendees.length}</span>
                                <span>✅ {done}/{total}</span>
                              </div>
                              {total > 0 && <div style={{ marginTop: 6, height: 3, background: '#eee', borderRadius: 3, width: 180 }}><div style={{ height: 3, background: pct === 100 ? '#16a34a' : R, borderRadius: 3, width: pct + '%' }} /></div>}
                            </div>
                            <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                              <Btn onClick={() => { setPrevM(m); setView('preview'); }} title="Preview" bg="#f0f0f0" c={DK}>👁</Btn>
                              <Btn onClick={() => exportPDF(m)} title="Download" bg={LR} c={R}>⬇</Btn>
                              <Btn onClick={() => { setEditM(m); setView('edit'); }} title="Edit" bg="#e8f0fe" c="#1a73e8">✏️</Btn>
                              <Btn onClick={() => handleDelete(m.id)} title="Delete" bg={LR} c={R}>🗑</Btn>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
              }
            </div>
          )}
          {tab === 'actions' && <ActionTracker allActs={allActs} updStatus={updStatus} />}
        </div>
      )}
    </div>
  );
}
