// ─── Brand Colors ──────────────────────────────────────────────────────────
export const R   = '#E8192C';
export const DK  = '#1A1A1A';
export const GR  = '#555555';
export const LR  = '#fff0f1';
export const BD  = '#E8E8E8';
export const MID = '#F7F7F7';
export const BG  = '#F4F4F6';

// ─── Status Colors ─────────────────────────────────────────────────────────
export const SC = {
  'Open':        '#1a73e8',
  'In Progress': '#d97706',
  'Done':        '#16a34a',
  'Overdue':     '#E8192C',
};
export const SB = {
  'Open':        '#dbeafe',
  'In Progress': '#fef3c7',
  'Done':        '#dcfce7',
  'Overdue':     '#fee2e2',
};

// ─── Data ──────────────────────────────────────────────────────────────────
export const CATS  = ['Sales', 'Technical', 'Operations', 'HR', 'Finance', 'Other'];
export const STATS = ['Open', 'In Progress', 'Done', 'Overdue'];

// ─── Tools Registry — add new tools here ───────────────────────────────────
export const TOOLS = [
  {
    id: 'mom',
    label: 'MoM Generator',
    icon: '📋',
    description: 'Create and track Meeting Minutes with AI transcript parsing.',
    status: 'active',   // 'active' | 'coming_soon' | 'beta'
    route: 'mom',
  },
  {
    id: 'sow',
    label: 'SOW Generator',
    icon: '📄',
    description: 'Generate Statements of Work from project briefs automatically.',
    status: 'coming_soon',
    route: 'sow',
  },
  {
    id: 'proposal',
    label: 'Proposal Generator',
    icon: '💼',
    description: 'Build professional client proposals with pricing and timelines.',
    status: 'coming_soon',
    route: 'proposal',
  },
  {
    id: 'email',
    label: 'Client Email Drafts',
    icon: '✉️',
    description: 'Draft follow-up, escalation and onboarding emails instantly.',
    status: 'coming_soon',
    route: 'email',
  },
];

// ─── UID ───────────────────────────────────────────────────────────────────
export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// ─── Blank MoM ─────────────────────────────────────────────────────────────
export function blankMoM(userId = '') {
  return {
    _new: true,
    id: uid(),
    title: '',
    client: '',
    date: new Date().toISOString().slice(0, 10),
    time: '',
    platform: 'Video Call',
    location: '',
    category: '',
    agenda: [''],
    attendees:   [{ id: uid(), name: '', org: '', role: '', present: true }],
    discussions: [{ id: uid(), topic: '', details: '', owner: '' }],
    actionItems: [{ id: uid(), action: '', owner: '', deadline: '', status: 'Open', team: '' }],
    createdBy: userId,
    createdAt: new Date().toISOString(),
  };
}
