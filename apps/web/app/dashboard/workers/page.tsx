'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { getWorkers, getManagers, getWorkerStores, createWorker, updateWorker, reassignWorker, setWorkerPin } from '@/lib/api';

interface Store { id: string; name: string }
interface ActiveSession {
  id: string; sessionCode: string; startedAt: string;
  _count: { scanLogs: number };
}
interface Worker {
  id: string; employeeId: string; name: string;
  isActive: boolean; storeId: string | null;
  store: Store | null; activeSession: ActiveSession | null;
  todayScans: number; scanning: boolean; createdAt: string;
}
interface Credentials { employeeId: string; pin: string }

// ── Modal ──────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-slate-900 font-bold text-lg">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Credentials reveal card ────────────────────────────────────────────
function CredentialsCard({ creds, onClose }: { creds: Credentials; onClose: () => void }) {
  const [copiedId, setCopiedId] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);

  const copy = (text: string, setter: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  return (
    <Modal title="Account Created" onClose={onClose}>
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
        <p className="text-amber-800 text-xs font-semibold mb-1">⚠ Show credentials NOW</p>
        <p className="text-amber-700 text-xs">PIN is hashed after this — it cannot be retrieved again. Reset if lost.</p>
      </div>
      <div className="space-y-3">
        {[
          { label: 'Employee ID', value: creds.employeeId, copied: copiedId, setter: setCopiedId },
          { label: 'PIN', value: creds.pin, copied: copiedPin, setter: setCopiedPin },
        ].map(({ label, value, copied, setter }) => (
          <div key={label}>
            <p className="text-slate-500 text-xs mb-1">{label}</p>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
              <span className="flex-1 font-mono text-slate-900 text-sm tracking-widest">{value}</span>
              <button
                onClick={() => copy(value, setter)}
                className="text-xs text-slate-500 hover:text-blue-600 transition-colors font-medium"
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={onClose}
        className="mt-5 w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
      >
        Done — I&apos;ve noted the credentials
      </button>
    </Modal>
  );
}

// ── Set PIN Modal ──────────────────────────────────────────────────────
function SetPinModal({ worker, onClose, onDone }: { worker: { id: string; name: string }; onClose: () => void; onDone: () => void }) {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4,6}$/.test(pin)) { setError('PIN must be 4–6 digits'); return; }
    setLoading(true); setError('');
    try {
      await setWorkerPin(worker.id, pin);
      onDone();
    } catch (e: any) {
      setError(e.response?.data?.error ?? 'Failed to set PIN');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={`Set PIN — ${worker.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-blue-700 text-xs">
          Enter new PIN for this account. Share it with them directly.
        </div>
        <div>
          <label className="block text-slate-600 text-xs font-medium mb-1.5">New PIN (4–6 digits)</label>
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="e.g. 1234"
            inputMode="numeric"
            autoFocus
            className="w-full bg-white border border-slate-300 text-slate-900 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono tracking-widest placeholder:text-slate-400 placeholder:tracking-normal"
          />
          <p className="text-slate-400 text-xs mt-1">{pin.length}/6 digits</p>
        </div>
        {error && <p className="text-red-600 text-xs bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{error}</p>}
        <button
          type="submit" disabled={loading || pin.length < 4}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {loading
            ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Setting…</>
            : 'Set PIN'}
        </button>
      </form>
    </Modal>
  );
}

// ── Add Worker Modal ───────────────────────────────────────────────────
function AddWorkerModal({
  stores, userRole, onClose, onCreated,
}: {
  stores: Store[]; userRole: string;
  onClose: () => void; onCreated: (creds: Credentials) => void;
}) {
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [storeId, setStoreId] = useState(stores[0]?.id ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4,6}$/.test(pin)) { setError('PIN must be 4–6 digits'); return; }
    setLoading(true); setError('');
    try {
      const res = await createWorker({
        name: name.trim(),
        pin,
        ...(userRole === 'OWNER' ? { storeId } : {}),
      });
      onCreated(res.data.credentials);
    } catch (e: any) {
      setError(e.response?.data?.error ?? 'Creation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Add New Worker" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-slate-600 text-xs font-medium mb-1.5">Full Name</label>
          <input
            value={name} onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Ankit Verma" required minLength={2}
            className="w-full bg-white border border-slate-300 text-slate-900 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400"
          />
        </div>

        <div>
          <label className="block text-slate-600 text-xs font-medium mb-1.5">PIN (4–6 digits)</label>
          <input
            value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="e.g. 4321" required inputMode="numeric"
            className="w-full bg-white border border-slate-300 text-slate-900 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono tracking-widest placeholder:text-slate-400 placeholder:tracking-normal"
          />
        </div>

        {userRole === 'OWNER' && stores.length > 0 && (
          <div>
            <label className="block text-slate-600 text-xs font-medium mb-1.5">Assign to Store</label>
            <select
              value={storeId} onChange={(e) => setStoreId(e.target.value)} required
              className="w-full bg-white border border-slate-300 text-slate-900 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}

        {error && <p className="text-red-600 text-xs bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{error}</p>}

        <button
          type="submit" disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {loading
            ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating…</>
            : 'Create Worker'}
        </button>
      </form>
    </Modal>
  );
}

// ── Add Manager Modal ──────────────────────────────────────────────────
function AddManagerModal({
  stores, onClose, onCreated,
}: {
  stores: Store[];
  onClose: () => void; onCreated: (creds: Credentials) => void;
}) {
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [storeId, setStoreId] = useState(stores[0]?.id ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4,6}$/.test(pin)) { setError('PIN must be 4–6 digits'); return; }
    if (!storeId) { setError('Please select a store'); return; }
    setLoading(true); setError('');
    try {
      const res = await createWorker({ name: name.trim(), pin, storeId, role: 'ADMIN' });
      onCreated(res.data.credentials);
    } catch (e: any) {
      setError(e.response?.data?.error ?? 'Creation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Add Store Manager" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-purple-700 text-xs">
          Managers can start audits, view reports, and manage workers at their assigned store.
        </div>

        <div>
          <label className="block text-slate-600 text-xs font-medium mb-1.5">Full Name</label>
          <input
            value={name} onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Suresh Sharma" required minLength={2}
            className="w-full bg-white border border-slate-300 text-slate-900 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400"
          />
        </div>

        <div>
          <label className="block text-slate-600 text-xs font-medium mb-1.5">PIN (4–6 digits)</label>
          <input
            value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="e.g. 5678" required inputMode="numeric"
            className="w-full bg-white border border-slate-300 text-slate-900 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono tracking-widest placeholder:text-slate-400 placeholder:tracking-normal"
          />
        </div>

        <div>
          <label className="block text-slate-600 text-xs font-medium mb-1.5">Assign to Store</label>
          <select
            value={storeId} onChange={(e) => setStoreId(e.target.value)} required
            className="w-full bg-white border border-slate-300 text-slate-900 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        {error && <p className="text-red-600 text-xs bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{error}</p>}

        <button
          type="submit" disabled={loading}
          className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {loading
            ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating…</>
            : 'Create Manager'}
        </button>
      </form>
    </Modal>
  );
}

// ── Edit Worker Modal ──────────────────────────────────────────────────
function EditWorkerModal({
  worker, stores, userRole, onClose, onUpdated,
}: {
  worker: Worker; stores: Store[]; userRole: string;
  onClose: () => void; onUpdated: (creds?: Credentials) => void;
}) {
  const [name, setName] = useState(worker.name);
  const [newPin, setNewPin] = useState('');
  const [resetPin, setResetPin] = useState(false);
  const [newStore, setNewStore] = useState(worker.storeId ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetPin && !/^\d{4,6}$/.test(newPin)) { setError('PIN must be 4–6 digits'); return; }
    setLoading(true); setError('');
    try {
      const updateData: Record<string, unknown> = {};
      if (name.trim() !== worker.name) updateData.name = name.trim();
      if (resetPin && newPin) updateData.pin = newPin;

      let creds: Credentials | undefined;
      if (Object.keys(updateData).length > 0) {
        const res = await updateWorker(worker.id, updateData);
        if (res.data.credentials) creds = res.data.credentials;
      }

      if (newStore && newStore !== worker.storeId) {
        await reassignWorker(worker.id, newStore);
      }

      onUpdated(creds);
    } catch (e: any) {
      setError(e.response?.data?.error ?? 'Update failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={`Edit — ${worker.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-slate-600 text-xs font-medium mb-1.5">Full Name</label>
          <input
            value={name} onChange={(e) => setName(e.target.value)} required minLength={2}
            className="w-full bg-white border border-slate-300 text-slate-900 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={resetPin} onChange={(e) => setResetPin(e.target.checked)}
              className="w-4 h-4 rounded accent-blue-500" />
            <span className="text-slate-600 text-xs font-medium">Reset PIN</span>
          </label>
          {resetPin && (
            <input
              value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="New PIN (4–6 digits)" inputMode="numeric"
              className="mt-2 w-full bg-white border border-slate-300 text-slate-900 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono tracking-widest"
            />
          )}
        </div>

        {userRole === 'OWNER' && stores.length > 1 && (
          <div>
            <label className="block text-slate-600 text-xs font-medium mb-1.5">Store Assignment</label>
            <select
              value={newStore} onChange={(e) => setNewStore(e.target.value)}
              className="w-full bg-white border border-slate-300 text-slate-900 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}

        {error && <p className="text-red-600 text-xs bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{error}</p>}

        <button
          type="submit" disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {loading
            ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</>
            : 'Save Changes'}
        </button>
      </form>
    </Modal>
  );
}

// ── Worker Table Component ─────────────────────────────────────────────
function WorkerTable({
  title, workers, stores, allowReassign, togglingId, onEdit, onSetPin, onToggle, onReassigned, dimmed, badge,
}: {
  title: string; workers: Worker[]; stores: Store[]; allowReassign: boolean;
  togglingId: string | null;
  onEdit: (w: Worker) => void;
  onSetPin: (w: Worker) => void;
  onToggle: (w: Worker) => void;
  onReassigned: () => void;
  dimmed?: boolean;
  badge?: string;
}) {
  const [reassigning, setReassigning] = useState<string | null>(null);

  const handleReassign = async (workerId: string, storeId: string) => {
    setReassigning(workerId);
    try {
      await reassignWorker(workerId, storeId);
      onReassigned();
    } catch (e: any) {
      alert(e.response?.data?.error ?? 'Reassignment failed');
    } finally {
      setReassigning(null);
    }
  };

  return (
    <div className={`bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm ${dimmed ? 'opacity-60' : ''}`}>
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
          {badge && (
            <span className="text-xs bg-purple-100 text-purple-700 font-medium px-2 py-0.5 rounded-full">{badge}</span>
          )}
        </div>
        <span className="text-xs text-slate-500">{workers.length} account{workers.length !== 1 ? 's' : ''}</span>
      </div>

      {workers.length === 0 ? (
        <div className="p-10 text-center text-slate-400 text-sm">None yet</div>
      ) : (
        <>
          <div className="grid grid-cols-[2fr_1.2fr_1.5fr_1.2fr_1fr_auto] gap-4 px-5 py-2.5 border-b border-slate-100">
            {['Name', 'Employee ID', 'Store', 'Session / Scans', "Today's Scans", 'Actions'].map((h) => (
              <p key={h} className="text-slate-400 text-xs font-semibold uppercase tracking-wider">{h}</p>
            ))}
          </div>

          <div className="divide-y divide-slate-100">
            {workers.map((w) => (
              <div key={w.id} className="grid grid-cols-[2fr_1.2fr_1.5fr_1.2fr_1fr_auto] gap-4 px-5 py-3.5 items-center hover:bg-slate-50 transition-colors">
                {/* Name + status dot */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700">
                      {w.name.charAt(0).toUpperCase()}
                    </div>
                    <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
                      !w.isActive ? 'bg-slate-300' : w.scanning ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                    }`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-slate-900 text-sm font-medium truncate">{w.name}</p>
                    <p className="text-slate-400 text-xs">{new Date(w.createdAt).toLocaleDateString('en-IN')}</p>
                  </div>
                </div>

                {/* Emp ID */}
                <p className="text-slate-500 text-xs font-mono">{w.employeeId}</p>

                {/* Store */}
                <div>
                  {allowReassign && stores.length > 1 ? (
                    <select
                      value={w.storeId ?? ''}
                      disabled={reassigning === w.id}
                      onChange={(e) => handleReassign(w.id, e.target.value)}
                      className="bg-white border border-slate-300 text-slate-700 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 w-full"
                    >
                      {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  ) : (
                    <p className="text-slate-600 text-xs">{w.store?.name ?? <span className="text-amber-600">Unassigned</span>}</p>
                  )}
                </div>

                {/* Session */}
                <div className="text-xs">
                  {w.scanning && w.activeSession ? (
                    <>
                      <span className="text-emerald-600 font-semibold">Scanning</span>
                      <span className="text-slate-400 ml-1">· {w.activeSession._count.scanLogs} QRs</span>
                      <p className="text-slate-500 font-mono mt-0.5 text-xs">{w.activeSession.sessionCode}</p>
                    </>
                  ) : (
                    <span className="text-slate-400">Idle</span>
                  )}
                </div>

                {/* Today scans */}
                <p className="text-blue-600 font-bold text-sm">{w.todayScans}</p>

                {/* Actions */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onSetPin(w)}
                    className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                    title="Set PIN"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => onEdit(w)}
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => onToggle(w)}
                    disabled={togglingId === w.id}
                    className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                      w.isActive
                        ? 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                        : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                    }`}
                    title={w.isActive ? 'Deactivate' : 'Reactivate'}
                  >
                    {w.isActive ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────
export default function WorkersPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [managers, setManagers] = useState<Worker[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [userRole, setUserRole] = useState('ADMIN');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showAdd, setShowAdd] = useState(false);
  const [showAddManager, setShowAddManager] = useState(false);
  const [editWorker, setEditWorker] = useState<Worker | null>(null);
  const [setPinWorker, setSetPinWorker] = useState<Worker | null>(null);
  const [pendingCredentials, setPendingCredentials] = useState<Credentials | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const userRoleRef = useRef('ADMIN');

  const load = useCallback(async () => {
    try {
      const isOwner = userRoleRef.current === 'OWNER';
      const promises: Promise<any>[] = [getWorkers(), getWorkerStores()];
      if (isOwner) promises.push(getManagers());

      const results = await Promise.all(promises);
      setWorkers(results[0].data.workers);
      setStores(results[1].data.stores);
      if (isOwner && results[2]) setManagers(results[2].data.managers);
    } catch (e: any) {
      setError(e.response?.data?.error ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('user_info');
      if (raw) {
        const role = JSON.parse(raw).role ?? 'ADMIN';
        userRoleRef.current = role;
        setUserRole(role);
      }
    } catch {}
    load();
    intervalRef.current = setInterval(load, 15000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [load]);

  const handleToggleActive = async (w: Worker) => {
    setTogglingId(w.id);
    try {
      await updateWorker(w.id, { isActive: !w.isActive });
      await load();
    } catch (e: any) {
      alert(e.response?.data?.error ?? 'Failed');
    } finally {
      setTogglingId(null);
    }
  };

  const activeCount = workers.filter((w) => w.isActive && w.scanning).length;
  const totalScans = workers.reduce((a, w) => a + w.todayScans, 0);
  const activeWorkers = workers.filter((w) => w.isActive);
  const inactiveWorkers = workers.filter((w) => !w.isActive);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Workers</h1>
            <p className="text-slate-500 text-sm mt-0.5">Manage staff accounts, credentials, and store assignments</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 text-sm rounded-xl transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
            {userRole === 'OWNER' && (
              <button
                onClick={() => setShowAddManager(true)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Manager
              </button>
            )}
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Worker
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Staff', value: workers.length, color: 'text-slate-900', bg: 'bg-slate-50', border: 'border-slate-200' },
            { label: 'Active Accounts', value: activeWorkers.length, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
            { label: 'Scanning Now', value: activeCount, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', pulse: activeCount > 0 },
            { label: "Today's Scans", value: totalScans, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
          ].map(({ label, value, color, bg, border, pulse }) => (
            <div key={label} className={`${bg} border ${border} rounded-xl p-4 shadow-sm`}>
              <p className="text-slate-500 text-xs font-medium mb-1">{label}</p>
              <div className="flex items-center gap-2">
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                {pulse && <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />}
              </div>
            </div>
          ))}
        </div>

        {/* Managers section — OWNER only */}
        {userRole === 'OWNER' && (
          <WorkerTable
            title="Store Managers"
            badge="Admin"
            workers={managers}
            stores={stores}
            allowReassign={false}
            togglingId={togglingId}
            onEdit={setEditWorker}
            onSetPin={setSetPinWorker}
            onToggle={handleToggleActive}
            onReassigned={load}
          />
        )}

        {/* Active Workers */}
        <WorkerTable
          title="Active Workers"
          workers={activeWorkers}
          stores={stores}
          allowReassign={userRole === 'OWNER'}
          togglingId={togglingId}
          onEdit={setEditWorker}
          onSetPin={setSetPinWorker}
          onToggle={handleToggleActive}
          onReassigned={load}
        />

        {/* Deactivated Workers */}
        {inactiveWorkers.length > 0 && (
          <WorkerTable
            title="Deactivated"
            workers={inactiveWorkers}
            stores={stores}
            allowReassign={userRole === 'OWNER'}
            togglingId={togglingId}
            onEdit={setEditWorker}
            onSetPin={setSetPinWorker}
            onToggle={handleToggleActive}
            onReassigned={load}
            dimmed
          />
        )}
      </div>

      {/* Modals */}
      {showAdd && (
        <AddWorkerModal
          stores={stores}
          userRole={userRole}
          onClose={() => setShowAdd(false)}
          onCreated={(creds) => {
            setShowAdd(false);
            setPendingCredentials(creds);
            load();
          }}
        />
      )}

      {showAddManager && (
        <AddManagerModal
          stores={stores}
          onClose={() => setShowAddManager(false)}
          onCreated={(creds) => {
            setShowAddManager(false);
            setPendingCredentials(creds);
            load();
          }}
        />
      )}

      {editWorker && (
        <EditWorkerModal
          worker={editWorker}
          stores={stores}
          userRole={userRole}
          onClose={() => setEditWorker(null)}
          onUpdated={(creds) => {
            setEditWorker(null);
            if (creds) setPendingCredentials(creds);
            load();
          }}
        />
      )}

      {setPinWorker && (
        <SetPinModal
          worker={setPinWorker}
          onClose={() => setSetPinWorker(null)}
          onDone={() => {
            setSetPinWorker(null);
            load();
          }}
        />
      )}

      {pendingCredentials && (
        <CredentialsCard
          creds={pendingCredentials}
          onClose={() => setPendingCredentials(null)}
        />
      )}
    </>
  );
}
