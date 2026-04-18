import { R, DK, GR, BD, TOOLS } from '../lib/constants';

export default function ToolsHub({ toolId, tools }) {
  const tool = tools.find(t => t.id === toolId) || tools[0];

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '60px 20px', textAlign: 'center' }}>
      {/* Big icon */}
      <div style={{ fontSize: 64, marginBottom: 20 }}>{tool.icon}</div>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: DK, marginBottom: 8 }}>{tool.label}</h1>
      <p style={{ fontSize: 16, color: GR, marginBottom: 36, maxWidth: 420, margin: '0 auto 36px' }}>{tool.description}</p>

      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#fff8e6', border: '1px solid #fcd34d', borderRadius: 100, padding: '8px 20px', marginBottom: 48 }}>
        <span>🚧</span>
        <span style={{ fontWeight: 700, fontSize: 14, color: '#b45309' }}>Coming soon — we're building this!</span>
      </div>

      {/* All tools grid */}
      <div style={{ textAlign: 'left', marginTop: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 14 }}>All Tools</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {TOOLS.map(t => {
            const isActive = t.status === 'active';
            const isCurrent = t.id === toolId;
            return (
              <div key={t.id} style={{ padding: '16px 18px', background: isCurrent ? '#fff8f8' : '#fff', border: `1.5px solid ${isCurrent ? R : BD}`, borderRadius: 12, opacity: isActive ? 1 : .7 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 22 }}>{t.icon}</span>
                  <span style={{ fontWeight: 700, fontSize: 14, color: DK }}>{t.label}</span>
                  <span style={{ marginLeft: 'auto', background: isActive ? '#dcfce7' : '#f3f4f6', color: isActive ? '#16a34a' : '#9ca3af', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                    {isActive ? 'Active' : 'Soon'}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: GR, margin: 0, lineHeight: 1.5 }}>{t.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
