'use client';

import { useEffect, useState, useCallback } from 'react';
import { getStores, createStore, updateStore } from '@/lib/api';

interface Store {
  id: string;
  name: string;
  address: string | null;
  gstin: string | null;
  licenseNo: string | null;
  isActive: boolean;
  createdAt: string;
  _count: { users: number; auditSessions: number };
}

// ── Modal ────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-lg p-6">
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

// ── Store Form ────────────────────────────────────────────────────────────
function StoreForm({
  initial,
  onSubmit,
  loading,
  error,
}: {
  initial?: Partial<Store>;
  onSubmit: (data: { name: string; address: string; gstin: string; licenseNo: string }) => void;
  loading: boolean;
  error: string;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [address, setAddress] = useState(initial?.address ?? '');
  const [gstin, setGstin] = useState(initial?.gstin ?? '');
  const [licenseNo, setLicenseNo] = useState(initial?.licenseNo ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name: name.trim(), address: address.trim(), gstin: gstin.trim(), licenseNo: licenseNo.trim() });
  };

  const inputCls = 'w-full bg-white border border-slate-300 text-slate-900 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-slate-600 text-xs font-medium mb-1.5">Store Name <span className="text-red-500">*</span></label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. MG Road Branch" required minLength={2} className={inputCls} />
      </div>
      <div>
        <label className="block text-slate-600 text-xs font-medium mb-1.5">Address</label>
        <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Full address" className={inputCls} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-slate-600 text-xs font-medium mb-1.5">GSTIN</label>
          <input value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} placeholder="22AAAAA0000A1Z5" maxLength={15} className={inputCls} />
        </div>
        <div>
          <label className="block text-slate-600 text-xs font-medium mb-1.5">License No.</label>
          <input value={licenseNo} onChange={(e) => setLicenseNo(e.target.value)} placeholder="FL/BR/KA/123" className={inputCls} />
        </div>
      </div>
      {error && <p className="text-red-600 text-xs bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{error}</p>}
      <button
        type="submit" disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
      >
        {loading
          ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</>
          : initial?.id ? 'Save Changes' : 'Create Store'}
      </button>
    </form>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────
export default function StoresPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editStore, setEditStore] = useState<Store | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await getStores();
      setStores(res.data.stores);
    } catch (e: any) {
      setPageError(e.response?.data?.error ?? 'Failed to load stores');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (data: { name: string; address: string; gstin: string; licenseNo: string }) => {
    setFormLoading(true); setFormError('');
    try {
      await createStore({
        name: data.name,
        ...(data.address ? { address: data.address } : {}),
        ...(data.gstin ? { gstin: data.gstin } : {}),
        ...(data.licenseNo ? { licenseNo: data.licenseNo } : {}),
      });
      setShowAdd(false);
      await load();
    } catch (e: any) {
      setFormError(e.response?.data?.error ?? 'Creation failed');
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdate = async (data: { name: string; address: string; gstin: string; licenseNo: string }) => {
    if (!editStore) return;
    setFormLoading(true); setFormError('');
    try {
      await updateStore(editStore.id, {
        name: data.name,
        ...(data.address ? { address: data.address } : {}),
        ...(data.gstin ? { gstin: data.gstin } : {}),
        ...(data.licenseNo ? { licenseNo: data.licenseNo } : {}),
      });
      setEditStore(null);
      await load();
    } catch (e: any) {
      setFormError(e.response?.data?.error ?? 'Update failed');
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggle = async (store: Store) => {
    setTogglingId(store.id);
    try {
      await updateStore(store.id, { isActive: !store.isActive });
      await load();
    } catch (e: any) {
      alert(e.response?.data?.error ?? 'Failed');
    } finally {
      setTogglingId(null);
    }
  };

  const activeStores = stores.filter((s) => s.isActive);
  const inactiveStores = stores.filter((s) => !s.isActive);

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
            <h1 className="text-2xl font-bold text-slate-900">Stores</h1>
            <p className="text-slate-500 text-sm mt-0.5">Manage your store locations and details</p>
          </div>
          <button
            onClick={() => { setFormError(''); setShowAdd(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Store
          </button>
        </div>

        {pageError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{pageError}</div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Stores', value: stores.length, color: 'text-slate-900', bg: 'bg-slate-50', border: 'border-slate-200' },
            { label: 'Active', value: activeStores.length, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
            { label: 'Total Active Staff', value: stores.reduce((a, s) => a + s._count.users, 0), color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
          ].map(({ label, value, color, bg, border }) => (
            <div key={label} className={`${bg} border ${border} rounded-xl p-4 shadow-sm`}>
              <p className="text-slate-500 text-xs font-medium mb-1">{label}</p>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Active Stores */}
        <StoreTable
          title="Active Stores"
          stores={activeStores}
          togglingId={togglingId}
          onEdit={(s) => { setFormError(''); setEditStore(s); }}
          onToggle={handleToggle}
        />

        {/* Inactive Stores */}
        {inactiveStores.length > 0 && (
          <StoreTable
            title="Inactive Stores"
            stores={inactiveStores}
            togglingId={togglingId}
            onEdit={(s) => { setFormError(''); setEditStore(s); }}
            onToggle={handleToggle}
            dimmed
          />
        )}

        {stores.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm">
            <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <p className="text-slate-400 text-sm">No stores yet. Click "Add Store" to create one.</p>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAdd && (
        <Modal title="Add New Store" onClose={() => setShowAdd(false)}>
          <StoreForm onSubmit={handleCreate} loading={formLoading} error={formError} />
        </Modal>
      )}

      {/* Edit Modal */}
      {editStore && (
        <Modal title={`Edit — ${editStore.name}`} onClose={() => setEditStore(null)}>
          <StoreForm initial={editStore} onSubmit={handleUpdate} loading={formLoading} error={formError} />
        </Modal>
      )}
    </>
  );
}

// ── Store Table ───────────────────────────────────────────────────────────
function StoreTable({
  title, stores, togglingId, onEdit, onToggle, dimmed,
}: {
  title: string;
  stores: Store[];
  togglingId: string | null;
  onEdit: (s: Store) => void;
  onToggle: (s: Store) => void;
  dimmed?: boolean;
}) {
  return (
    <div className={`bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm ${dimmed ? 'opacity-60' : ''}`}>
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
        <span className="text-xs text-slate-500">{stores.length} store{stores.length !== 1 ? 's' : ''}</span>
      </div>

      {stores.length === 0 ? (
        <div className="p-10 text-center text-slate-400 text-sm">No stores</div>
      ) : (
        <div className="divide-y divide-slate-100">
          {stores.map((s) => (
            <div key={s.id} className="px-5 py-4 hover:bg-slate-50 transition-colors">
              <div className="flex items-start justify-between gap-4">
                {/* Left: store info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${s.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    <p className="text-slate-900 font-semibold text-sm">{s.name}</p>
                  </div>
                  {s.address && (
                    <p className="text-slate-400 text-xs mb-1.5 ml-4">{s.address}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-3 ml-4">
                    {s.gstin && (
                      <span className="text-xs text-slate-500 font-mono">GSTIN: {s.gstin}</span>
                    )}
                    {s.licenseNo && (
                      <span className="text-xs text-slate-500">Lic: {s.licenseNo}</span>
                    )}
                  </div>
                </div>

                {/* Right: stats + actions */}
                <div className="flex items-center gap-6 flex-shrink-0">
                  <div className="text-center">
                    <p className="text-lg font-bold text-blue-600">{s._count.users}</p>
                    <p className="text-xs text-slate-400">Staff</p>
                  </div>
                  <div className="text-center">
                    <p className={`text-lg font-bold ${s._count.auditSessions > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {s._count.auditSessions}
                    </p>
                    <p className="text-xs text-slate-400">Active</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onEdit(s)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onToggle(s)}
                      disabled={togglingId === s.id}
                      className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                        s.isActive
                          ? 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                          : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                      }`}
                      title={s.isActive ? 'Deactivate' : 'Reactivate'}
                    >
                      {togglingId === s.id ? (
                        <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                      ) : s.isActive ? (
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
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
