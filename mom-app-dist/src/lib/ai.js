import { CATS, STATS, uid } from './constants';

// ─── Core caller ────────────────────────────────────────────────────────────
async function callAI(prompt, apiKey, maxTokens = 1500) {
  if (!apiKey) throw new Error('NO_KEY');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    const msg = e?.error?.message || 'API error';
    if (res.status === 401) throw new Error('INVALID_KEY');
    throw new Error(msg);
  }
  const d = await res.json();
  return (d.content || []).map(i => i.text || '').join('');
}

async function callAIJSON(prompt, apiKey, maxTokens = 2000) {
  const raw = await callAI(prompt, apiKey, maxTokens);
  let c = raw.replace(/```json|```/gi, '').trim();
  const si = c.indexOf('{'); const ei = c.lastIndexOf('}');
  if (si < 0 || ei < 0) throw new Error('No JSON in response');
  c = c.slice(si, ei + 1).replace(/"([^"]*)"/g, m => m.replace(/[\n\r\t]/g, ' '));
  try { return JSON.parse(c); } catch {
    let f = c.replace(/,\s*$/, '');
    const ob = (f.match(/\[/g) || []).length - (f.match(/\]/g) || []).length;
    const cb = (f.match(/\{/g) || []).length - (f.match(/\}/g) || []).length;
    for (let i = 0; i < ob; i++) f += ']';
    for (let i = 0; i < cb; i++) f += '}';
    return JSON.parse(f);
  }
}

// ─── Test API key ───────────────────────────────────────────────────────────
export async function testApiKey(apiKey) {
  const text = await callAI('Reply with exactly: OK', apiKey, 10);
  return text.trim().includes('OK');
}

// ─── Generate MoM from transcript ──────────────────────────────────────────
export async function genFromTranscript(transcript, apiKey) {
  const r = await callAIJSON(
    `You are a professional meeting minutes writer. Extract a structured MoM from this transcript (may be noisy).
Return ONLY raw JSON. Escape all strings. No newlines inside strings. No markdown.
category must be one of: ${CATS.join(' ')}
present must be boolean. status must be one of: ${STATS.join(' ')}
Schema: {"title":"","client":"","date":"YYYY-MM-DD or empty","time":"","platform":"","location":"","category":"","agenda":[""],
"attendees":[{"name":"","org":"","role":"","present":true}],
"discussions":[{"topic":"","details":"","owner":""}],
"actionItems":[{"action":"","owner":"","deadline":"","status":"Open","team":""}]}
TRANSCRIPT: ${transcript}`,
    apiKey, 2500
  );
  const str = v => (typeof v === 'string' ? v : '');
  return {
    title: str(r.title) || 'Meeting Notes', client: str(r.client),
    date: str(r.date), time: str(r.time),
    platform: str(r.platform) || 'Video Call', location: str(r.location),
    category: CATS.includes(r.category) ? r.category : 'Technical',
    agenda: Array.isArray(r.agenda) && r.agenda.length ? r.agenda.map(str).filter(Boolean) : ['Discussion'],
    attendees: (Array.isArray(r.attendees) ? r.attendees : []).map(a => ({ id: uid(), name: str(a.name), org: str(a.org), role: str(a.role), present: a.present !== false })),
    discussions: (Array.isArray(r.discussions) ? r.discussions : []).map(d => ({ id: uid(), topic: str(d.topic), details: str(d.details), owner: str(d.owner) })),
    actionItems: (Array.isArray(r.actionItems) ? r.actionItems : []).map(a => ({ id: uid(), action: str(a.action), owner: str(a.owner), deadline: str(a.deadline), status: STATS.includes(a.status) ? a.status : 'Open', team: str(a.team) })),
  };
}

// ─── Smart suggestions while editing ───────────────────────────────────────
export async function getSuggestions(mom, apiKey) {
  if (!apiKey) return [];
  try {
    const raw = await callAI(
      `Smart MoM assistant. Give 3 brief suggestions for this meeting.
MoM: title="${mom.title}" client="${mom.client}" category="${mom.category}"
Return ONLY a JSON array of 3 short strings. No markdown.`,
      apiKey, 300
    );
    const m = raw.match(/\[[\s\S]*\]/);
    if (m) return JSON.parse(m[0]);
  } catch { /* silently ignore */ }
  return [];
}
