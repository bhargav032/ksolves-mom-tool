export function exportPDF(mom) {
  const f = v => (v || '—').toString().replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const teams = [...new Set(mom.actionItems.map(a => a.team || 'General'))];
  const badge = s => ({ Open: 'background:#dbeafe;color:#1d4ed8', 'In Progress': 'background:#fef3c7;color:#b45309', Done: 'background:#dcfce7;color:#15803d', Overdue: 'background:#fee2e2;color:#dc2626' }[s] || '');

  const aRows = mom.attendees.map((a, i) =>
    `<tr><td>${i+1}</td><td><b>${f(a.name)}</b></td><td>${f(a.org)}</td><td>${f(a.role)}</td><td style="color:${a.present?'#15803d':'#dc2626'};font-weight:700">${a.present?'✓ Present':'✗ Absent'}</td></tr>`).join('');

  const dRows = mom.discussions.filter(d=>d.topic).map((d,i) =>
    `<tr><td style="color:#E8192C;font-weight:700">${i+1}</td><td><b>${f(d.topic)}</b></td><td>${f(d.details)}</td><td>${f(d.owner)}</td></tr>`).join('');

  const acHTML = teams.map(t => {
    const items = mom.actionItems.filter(a=>(a.team||'General')===t&&a.action);
    if (!items.length) return '';
    const hdr = teams.length>1?`<tr><td colspan="5" style="background:#fdf0f1;color:#E8192C;font-weight:700">Action Items — ${t}:</td></tr>`:'';
    return hdr+items.map(a=>`<tr><td style="color:#E8192C">•</td><td>${f(a.action)}</td><td>${f(a.owner)}</td><td>${f(a.deadline)}</td><td><span style="padding:2px 7px;border-radius:3px;font-size:8pt;font-weight:700;${badge(a.status)}">${a.status}</span></td></tr>`).join('');
  }).join('');

  const agHTML = mom.agenda.filter(Boolean).map((g,i)=>`<tr><td style="color:#E8192C;font-weight:700;padding:4px 8px">${i+1}.</td><td style="padding:4px 8px">${f(g)}</td></tr>`).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${f(mom.title)}</title>
<style>@page{size:A4;margin:14mm 16mm}*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;font-size:10pt;color:#222;background:#fff}
table{width:100%;border-collapse:collapse;font-size:9.5pt}th{background:#f2f2f2;color:#1a1a1a;padding:6px 9px;text-align:left;font-size:8.5pt;font-weight:700;text-transform:uppercase;border-bottom:2px solid #E8192C}
td{padding:6px 9px;border-bottom:1px solid #ebebeb;vertical-align:top;color:#333}tr:nth-child(even) td{background:#fafafa}
.sec{background:#f2f2f2;border-left:4px solid #E8192C;padding:6px 12px;font-weight:700;font-size:9.5pt;color:#1a1a1a;margin:14px 0 0;text-transform:uppercase}
.np{display:none}@media screen{.np{display:flex};body{max-width:900px;margin:0 auto}}@media print{.np{display:none!important};body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>
<div class="np" style="background:#f5f5f5;padding:12px 20px;justify-content:space-between;align-items:center;border-bottom:2px solid #E8192C;position:sticky;top:0;z-index:99">
<span style="font-weight:700;color:#2B2B2B">${f(mom.title)}</span>
<div style="display:flex;gap:10px"><button onclick="window.print()" style="background:#E8192C;color:#fff;border:none;padding:8px 22px;border-radius:6px;font-weight:700;cursor:pointer">Print / Save as PDF</button>
<button onclick="window.close()" style="background:#eee;border:1px solid #ccc;padding:8px 16px;border-radius:6px;cursor:pointer">Close</button></div></div>
<div style="padding:4px 6px">
<table style="border-bottom:3px solid #E8192C;margin-bottom:12px"><tr>
<td style="border:none;padding:8px 4px;width:55%"><span style="color:#E8192C;font-weight:900;font-size:20pt">KSOLVES</span><br/><span style="color:#555;font-size:8pt;letter-spacing:2px">EMERGING AHEAD ALWAYS</span></td>
<td style="border:none;padding:8px 4px;text-align:right"><div style="font-weight:700;font-size:13pt">Minutes of Meeting</div><div style="color:#555;font-size:9.5pt;margin-top:3px">${f(mom.date)}</div>${mom.category?`<div style="margin-top:5px"><span style="background:#E8192C;color:#fff;border-radius:3px;padding:2px 9px;font-size:8pt;font-weight:700">${mom.category}</span></div>`:''}</td></tr></table>
<div style="background:#fdf0f1;border-left:4px solid #E8192C;padding:8px 14px;margin-bottom:14px"><b style="font-size:13pt">${f(mom.title)}</b></div>
<div class="sec">Meeting Details</div><table style="border:1px solid #ddd">
<tr><td style="font-weight:700;background:#f7f7f7;width:16%">Client</td><td>${f(mom.client)}</td><td style="font-weight:700;background:#f7f7f7;width:16%">Date</td><td>${f(mom.date)}</td></tr>
<tr><td style="font-weight:700;background:#f7f7f7">Time</td><td>${f(mom.time)}</td><td style="font-weight:700;background:#f7f7f7">Platform</td><td>${f(mom.platform)}</td></tr>
${mom.location?`<tr><td style="font-weight:700;background:#f7f7f7">Location</td><td colspan="3">${f(mom.location)}</td></tr>`:''}</table>
${agHTML?`<div class="sec">Agenda</div><table style="border:1px solid #ddd"><tbody>${agHTML}</tbody></table>`:''}
<div class="sec">Attendees</div><table style="border:1px solid #ddd"><thead><tr><th>#</th><th>Name</th><th>Organization</th><th>Role</th><th>Status</th></tr></thead><tbody>${aRows}</tbody></table>
${dRows?`<div class="sec">Discussion Points</div><table style="border:1px solid #ddd"><thead><tr><th>#</th><th>Topic</th><th>Details</th><th>Owner</th></tr></thead><tbody>${dRows}</tbody></table>`:''}
${mom.actionItems.some(a=>a.action)?`<div class="sec">Action Items</div><table style="border:1px solid #ddd"><thead><tr><th>#</th><th>Action</th><th>Owner</th><th>Deadline</th><th>Status</th></tr></thead><tbody>${acHTML}</tbody></table>`:''}
<table style="margin-top:20px;border-top:2px solid #E8192C;padding-top:10px"><tr>
<td style="border:none;font-style:italic;color:#777;font-size:8.5pt">Please let us know if you wish to add or edit anything.</td>
<td style="border:none;text-align:right;font-size:9pt"><b>Thanks &amp; Regards,</b><br/><span style="color:#E8192C;font-weight:700">Ksolves Team</span></td></tr></table>
</div></body></html>`;

  const b64 = btoa(unescape(encodeURIComponent(html)));
  const a = document.createElement('a');
  a.href = `data:text/html;base64,${b64}`;
  a.target = '_blank'; a.rel = 'noopener noreferrer';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}
