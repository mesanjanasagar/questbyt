import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  Button, Input, Badge,
  CheckCircleIcon, ChevronRightIcon, BuildingIcon, GitBranchIcon,
  LayoutGridIcon, UsersIcon, MonitorIcon, UtensilsIcon,
  PackageIcon, CreditCardIcon, BellIcon, PartyPopperIcon,
} from '@pos/ui';
import { onboardingAPI, storeAPI, branchAPI, tableAPI, userAPI, menuAPI } from '../../api/onboarding';
import type { OnboardingState, Branch, DiningArea, Table } from '@pos/shared-types';
import { cn } from '@pos/ui';

type StepId =
  | 'restaurant_setup'
  | 'branch_created'
  | 'tables_configured'
  | 'staff_added'
  | 'device_registered'
  | 'menu_created'
  | 'inventory_configured'
  | 'payment_configured'
  | 'notifications_configured'
  | 'completed';

const STEPS: Array<{ id: StepId; label: string; description: string; icon: React.ReactNode }> = [
  { id: 'restaurant_setup',       label: 'Restaurant',       description: 'Basic details',      icon: <BuildingIcon size={16} /> },
  { id: 'branch_created',         label: 'Branch',           description: 'Location setup',     icon: <GitBranchIcon size={16} /> },
  { id: 'tables_configured',      label: 'Tables',           description: 'Floor plan',         icon: <LayoutGridIcon size={16} /> },
  { id: 'staff_added',            label: 'Staff',            description: 'Team members',       icon: <UsersIcon size={16} /> },
  { id: 'device_registered',      label: 'Devices',          description: 'POS & KDS',          icon: <MonitorIcon size={16} /> },
  { id: 'menu_created',           label: 'Menu',             description: 'Items & categories', icon: <UtensilsIcon size={16} /> },
  { id: 'inventory_configured',   label: 'Inventory',        description: 'Stock levels',       icon: <PackageIcon size={16} /> },
  { id: 'payment_configured',     label: 'Payments',         description: 'Methods & config',   icon: <CreditCardIcon size={16} /> },
  { id: 'notifications_configured', label: 'Alerts',         description: 'Notifications',      icon: <BellIcon size={16} /> },
  { id: 'completed',              label: 'Ready',            description: 'All done!',          icon: <PartyPopperIcon size={16} /> },
];

export const OnboardingWizard: React.FC = () => {
  const { storeId } = useAuth();
  const navigate = useNavigate();

  const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);
  const [loading, setLoading] = useState(true);

  // Step-specific state
  const [branches, setBranches] = useState<Branch[]>([]);
  const [diningAreas, setDiningAreas] = useState<DiningArea[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [staff, setStaff] = useState<any[]>([]);

  const loadOnboarding = useCallback(async () => {
    if (!storeId) return;
    try {
      const state = await onboardingAPI.getState(storeId);
      setOnboarding(state);
    } catch {
      setOnboarding(null);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => { loadOnboarding(); }, [loadOnboarding]);

  const currentStepId: StepId = onboarding?.currentStep ?? 'restaurant_setup';
  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStepId);
  const completedSteps = new Set(onboarding?.completedSteps ?? []);

  const advanceTo = async (step: StepId) => {
    if (!storeId) return;
    const state = await onboardingAPI.completeStep(storeId, step);
    setOnboarding(state);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-sm text-muted-foreground animate-pulse">Loading…</div>
      </div>
    );
  }

  if (onboarding?.isComplete) {
    navigate('/', { replace: true });
    return null;
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="border-b border-neutral-200 bg-white px-6 py-4 flex items-center gap-4">
        <div className="w-8 h-8 rounded-lg bg-brand-900 flex items-center justify-center">
          <span className="text-white font-bold text-sm">Q</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-neutral-900">Setup Wizard</p>
          <p className="text-xs text-muted-foreground">Configure your restaurant before going live</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Step {Math.min(currentStepIndex + 1, STEPS.length - 1)} of {STEPS.length - 1}
          </span>
          <div className="w-24 h-1.5 bg-neutral-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-600 rounded-full transition-all duration-500"
              style={{ width: `${(currentStepIndex / (STEPS.length - 1)) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 flex gap-8">
        {/* Sidebar nav */}
        <aside className="w-56 flex-shrink-0">
          <nav className="space-y-1">
            {STEPS.map((step, i) => {
              const isDone = completedSteps.has(step.id);
              const isCurrent = step.id === currentStepId;
              const isLocked = i > currentStepIndex;
              return (
                <div
                  key={step.id}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                    isCurrent && 'bg-primary-50 text-primary-700',
                    isDone && !isCurrent && 'text-neutral-600',
                    isLocked && 'text-neutral-400 opacity-50 cursor-not-allowed',
                    !isCurrent && !isLocked && 'hover:bg-neutral-100 cursor-pointer',
                  )}
                >
                  <span className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold',
                    isDone ? 'bg-success-100 text-success-700' : isCurrent ? 'bg-primary-600 text-white' : 'bg-neutral-200 text-neutral-500',
                  )}>
                    {isDone ? <CheckCircleIcon size={14} /> : i + 1}
                  </span>
                  <div>
                    <div className={cn('font-medium leading-none', isCurrent ? 'text-primary-700' : '')}>{step.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{step.description}</div>
                  </div>
                </div>
              );
            })}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1">
          {currentStepId === 'restaurant_setup' && !storeId && (
            <RestaurantSetupStep onComplete={async (newStoreId) => {
              const state = await onboardingAPI.getState(newStoreId);
              setOnboarding(state);
            }} />
          )}
          {currentStepId === 'branch_created' && storeId && (
            <BranchStep
              storeId={storeId}
              branches={branches}
              setBranches={setBranches}
              onComplete={() => advanceTo('branch_created')}
            />
          )}
          {currentStepId === 'tables_configured' && storeId && (
            <TablesStep
              storeId={storeId}
              branches={branches}
              diningAreas={diningAreas}
              setDiningAreas={setDiningAreas}
              tables={tables}
              setTables={setTables}
              onComplete={() => advanceTo('tables_configured')}
            />
          )}
          {currentStepId === 'staff_added' && storeId && (
            <StaffStep
              storeId={storeId}
              branches={branches}
              staff={staff}
              setStaff={setStaff}
              onComplete={() => advanceTo('staff_added')}
            />
          )}
          {currentStepId === 'device_registered' && storeId && (
            <DeviceStep
              storeId={storeId}
              onComplete={() => advanceTo('device_registered')}
            />
          )}
          {currentStepId === 'menu_created' && storeId && (
            <MenuStep
              storeId={storeId}
              onComplete={() => advanceTo('menu_created')}
            />
          )}
          {currentStepId === 'inventory_configured' && storeId && (
            <InventoryStep
              storeId={storeId}
              onComplete={() => advanceTo('inventory_configured')}
            />
          )}
          {currentStepId === 'payment_configured' && storeId && (
            <PaymentStep
              storeId={storeId}
              onComplete={() => advanceTo('payment_configured')}
            />
          )}
          {currentStepId === 'notifications_configured' && storeId && (
            <NotificationsStep
              storeId={storeId}
              onComplete={async () => {
                if (!storeId) return;
                await onboardingAPI.complete(storeId);
                navigate('/', { replace: true });
              }}
            />
          )}
        </main>
      </div>
    </div>
  );
};

// ─── Step: Restaurant Setup ───────────────────────────────────────────────────

const RestaurantSetupStep: React.FC<{ onComplete: (storeId: string) => void }> = ({ onComplete }) => {
  const [name, setName] = useState('');
  const [businessType, setBusinessType] = useState('restaurant');
  const [currency, setCurrency] = useState('AED');
  const [timezone, setTimezone] = useState('Asia/Dubai');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const store = await storeAPI.create({ name, businessType, currency, timezone });
      localStorage.setItem('store_id', store.id);
      onComplete(store.id);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err?.response?.data?.message ?? 'Failed to create restaurant');
    } finally {
      setSaving(false);
    }
  };

  return (
    <StepCard
      title="Restaurant Details"
      description="Tell us about your restaurant. This information will appear on receipts and your customer-facing displays."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="field-label">Restaurant Name <span className="text-error-600">*</span></label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="The Grill House" required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="field-label">Business Type</label>
            <select
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
            >
              {['restaurant', 'cafe', 'bakery', 'food_truck', 'cloud_kitchen', 'retail'].map((t) => (
                <option key={t} value={t}>{t.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Currency</label>
            <select
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {['AED', 'SAR', 'USD', 'GBP', 'EUR'].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="field-label">Timezone</label>
          <select
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
          >
            {['Asia/Dubai', 'Asia/Riyadh', 'Africa/Cairo', 'Europe/London', 'America/New_York'].map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>
        {error && <ErrorBanner>{error}</ErrorBanner>}
        <StepFooter>
          <Button type="submit" variant="primary" loading={saving} disabled={!name.trim() || saving}>
            Create Restaurant <ChevronRightIcon size={16} />
          </Button>
        </StepFooter>
      </form>
    </StepCard>
  );
};

// ─── Step: Branch ─────────────────────────────────────────────────────────────

const BranchStep: React.FC<{
  storeId: string;
  branches: Branch[];
  setBranches: (b: Branch[]) => void;
  onComplete: () => void;
}> = ({ storeId, branches, setBranches, onComplete }) => {
  const [name, setName] = useState('');
  const [branchCode, setBranchCode] = useState('BR001');
  const [phone, setPhone] = useState('');
  const [timezone, setTimezone] = useState('Asia/Dubai');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    branchAPI.list(storeId).then(setBranches).catch(() => {});
  }, [storeId]);

  const addBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const branch = await branchAPI.create({
        storeId,
        branchCode,
        name,
        phone: phone || undefined,
        timezone,
        isMain: branches.length === 0,
      });
      setBranches([...branches, branch]);
      setName('');
      setBranchCode(`BR${String(branches.length + 2).padStart(3, '0')}`);
      setPhone('');
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err?.response?.data?.message ?? 'Failed to create branch');
    } finally {
      setSaving(false);
    }
  };

  return (
    <StepCard
      title="Branch / Location"
      description="Add at least one branch. Each branch can have its own floor plan, staff, and devices."
    >
      {branches.length > 0 && (
        <div className="mb-4 space-y-2">
          {branches.map((b) => (
            <div key={b.id} className="flex items-center gap-3 bg-success-50 border border-success-200 rounded-lg px-3 py-2.5">
              <CheckCircleIcon size={16} className="text-success-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-neutral-900">{b.name}</p>
                <p className="text-xs text-muted-foreground">{b.branchCode} · {b.timezone}</p>
              </div>
              {b.isMain && <Badge variant="primary" size="sm">Main</Badge>}
            </div>
          ))}
        </div>
      )}

      <form onSubmit={addBranch} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="field-label">Branch Name <span className="text-error-600">*</span></label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Downtown Branch" required />
          </div>
          <div>
            <label className="field-label">Branch Code</label>
            <Input value={branchCode} onChange={(e) => setBranchCode(e.target.value)} placeholder="BR001" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="field-label">Phone</label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+971 4 XXX XXXX" />
          </div>
          <div>
            <label className="field-label">Timezone</label>
            <select
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            >
              {['Asia/Dubai', 'Asia/Riyadh', 'Africa/Cairo', 'Europe/London', 'America/New_York'].map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
        </div>
        {error && <ErrorBanner>{error}</ErrorBanner>}
        <div className="flex gap-3">
          <Button type="submit" variant="secondary" loading={saving} disabled={!name.trim() || saving}>
            Add Branch
          </Button>
          {branches.length > 0 && (
            <Button type="button" variant="primary" onClick={onComplete}>
              Continue <ChevronRightIcon size={16} />
            </Button>
          )}
        </div>
      </form>
    </StepCard>
  );
};

// ─── Step: Tables ─────────────────────────────────────────────────────────────

const TablesStep: React.FC<{
  storeId: string;
  branches: Branch[];
  diningAreas: DiningArea[];
  setDiningAreas: (a: DiningArea[]) => void;
  tables: Table[];
  setTables: (t: Table[]) => void;
  onComplete: () => void;
}> = ({ storeId, branches, diningAreas, setDiningAreas, tables, setTables, onComplete }) => {
  const [selectedBranch, setSelectedBranch] = useState(branches[0]?.id ?? '');
  const [areaName, setAreaName] = useState('Main Dining');
  const [tableCount, setTableCount] = useState(10);
  const [capacity, setCapacity] = useState(4);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (selectedBranch) {
      Promise.all([
        branchAPI.getDiningAreas(selectedBranch),
        tableAPI.listByBranch(selectedBranch),
      ]).then(([areas, tbls]) => {
        setDiningAreas(areas);
        setTables(tbls);
      }).catch(() => {});
    }
  }, [selectedBranch]);

  const createArea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBranch) return;
    setSaving(true);
    setError('');
    try {
      const area = await branchAPI.createDiningArea(selectedBranch, {
        storeId,
        name: areaName,
        floorNumber: diningAreas.length + 1,
      });
      setDiningAreas([...diningAreas, area]);

      const newTables: Table[] = [];
      for (let i = 1; i <= tableCount; i++) {
        const table = await tableAPI.create({
          diningAreaId: area.id,
          branchId: selectedBranch,
          storeId,
          tableNumber: String(i),
          capacity,
        });
        newTables.push(table);
      }
      setTables([...tables, ...newTables]);
      setAreaName('');
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err?.response?.data?.message ?? 'Failed to create tables');
    } finally {
      setSaving(false);
    }
  };

  const totalTables = tables.length;

  return (
    <StepCard
      title="Floor Plan & Tables"
      description="Create dining areas (floors / sections) and add tables. Each table gets a unique QR code for tableside ordering."
    >
      {branches.length > 1 && (
        <div className="mb-4">
          <label className="field-label">Branch</label>
          <select
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
          >
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      )}

      {totalTables > 0 && (
        <div className="mb-4 bg-success-50 border border-success-200 rounded-lg px-4 py-3 flex items-center gap-3">
          <CheckCircleIcon size={16} className="text-success-600" />
          <p className="text-sm text-success-800 font-medium">{totalTables} tables configured across {diningAreas.length} area{diningAreas.length !== 1 ? 's' : ''}</p>
        </div>
      )}

      <form onSubmit={createArea} className="space-y-4">
        <div>
          <label className="field-label">Dining Area Name <span className="text-error-600">*</span></label>
          <Input value={areaName} onChange={(e) => setAreaName(e.target.value)} placeholder="Main Dining / Terrace / VIP" required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="field-label">Number of Tables</label>
            <Input
              type="number"
              min={1} max={200}
              value={tableCount}
              onChange={(e) => setTableCount(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="field-label">Default Capacity per Table</label>
            <Input
              type="number"
              min={1} max={50}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
            />
          </div>
        </div>
        {error && <ErrorBanner>{error}</ErrorBanner>}
        <div className="flex gap-3">
          <Button type="submit" variant="secondary" loading={saving} disabled={!areaName.trim() || saving}>
            Add Area & Tables
          </Button>
          {totalTables > 0 && (
            <Button type="button" variant="primary" onClick={onComplete}>
              Continue <ChevronRightIcon size={16} />
            </Button>
          )}
        </div>
      </form>
    </StepCard>
  );
};

// ─── Step: Staff ──────────────────────────────────────────────────────────────

const StaffStep: React.FC<{
  storeId: string;
  branches: Branch[];
  staff: any[];
  setStaff: (s: any[]) => void;
  onComplete: () => void;
}> = ({ storeId, branches, staff, setStaff, onComplete }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('cashier');
  const [branchId, setBranchId] = useState(branches[0]?.id ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    onboardingAPI.getStaff(storeId).then(setStaff).catch(() => {});
  }, [storeId]);

  const addStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      // 1. Create user account in auth-service
      const user = await userAPI.create({ storeId, username, email: email || undefined, password, role });
      // 2. Create staff profile in store-service
      await onboardingAPI.addStaffProfile(storeId, {
        userId: user.id,
        branchId: branchId || undefined,
        employeeNumber: `EMP${String(staff.length + 1).padStart(3, '0')}`,
        position: role,
      });
      const updated = await onboardingAPI.getStaff(storeId);
      setStaff(updated);
      setUsername('');
      setEmail('');
      setPassword('');
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err?.response?.data?.message ?? 'Failed to add staff member');
    } finally {
      setSaving(false);
    }
  };

  return (
    <StepCard
      title="Staff Management"
      description="Add your team members. Each staff member gets login credentials and role-based access to the POS system."
    >
      {staff.length > 0 && (
        <div className="mb-4 space-y-2">
          {staff.map((s, i) => (
            <div key={i} className="flex items-center gap-3 bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2">
              <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold">
                {(s.username ?? s.userId ?? '?')[0]?.toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-900">{s.username ?? s.userId}</p>
                <p className="text-xs text-muted-foreground">{s.position ?? s.role} · {s.employeeNumber}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={addStaff} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="field-label">Username <span className="text-error-600">*</span></label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="john.cashier" required />
          </div>
          <div>
            <label className="field-label">Email</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@restaurant.com" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="field-label">Password <span className="text-error-600">*</span></label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" required />
          </div>
          <div>
            <label className="field-label">Role</label>
            <select
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              {['cashier', 'waiter', 'kitchen', 'manager', 'admin'].map((r) => (
                <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>
        {branches.length > 1 && (
          <div>
            <label className="field-label">Assign to Branch</label>
            <select
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
            >
              <option value="">All Branches</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        )}
        {error && <ErrorBanner>{error}</ErrorBanner>}
        <div className="flex gap-3">
          <Button type="submit" variant="secondary" loading={saving} disabled={!username.trim() || !password || saving}>
            Add Staff Member
          </Button>
          {staff.length > 0 && (
            <Button type="button" variant="primary" onClick={onComplete}>
              Continue <ChevronRightIcon size={16} />
            </Button>
          )}
        </div>
      </form>
    </StepCard>
  );
};

// ─── Step: Device Registration ────────────────────────────────────────────────

const DeviceStep: React.FC<{ storeId: string; onComplete: () => void }> = ({ onComplete }) => {
  return (
    <StepCard
      title="Device Registration"
      description="Devices register themselves automatically when a staff member logs in from a new device. You can skip this step and let devices self-register during first login."
    >
      <div className="bg-info-50 border border-info-200 rounded-lg px-4 py-3 mb-6">
        <p className="text-sm text-info-800 font-medium">Auto-registration is enabled</p>
        <p className="text-xs text-info-700 mt-1">
          Each POS terminal, KDS screen, and kiosk will register automatically when a staff member signs in for the first time. No manual device setup required.
        </p>
      </div>
      <div className="space-y-3 mb-6">
        {[
          { label: 'POS Terminal', desc: 'Open the POS app and log in with cashier credentials' },
          { label: 'Kitchen Display (KDS)', desc: 'Open the KDS app and log in with kitchen credentials' },
          { label: 'Kiosk', desc: 'Open the Kiosk app and configure with admin credentials' },
        ].map((d) => (
          <div key={d.label} className="flex gap-3 p-3 rounded-lg border border-neutral-200 bg-white">
            <MonitorIcon size={18} className="text-neutral-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-neutral-800">{d.label}</p>
              <p className="text-xs text-muted-foreground">{d.desc}</p>
            </div>
          </div>
        ))}
      </div>
      <StepFooter>
        <Button variant="primary" onClick={onComplete}>
          Got it, Continue <ChevronRightIcon size={16} />
        </Button>
      </StepFooter>
    </StepCard>
  );
};

// ─── Step: Menu ───────────────────────────────────────────────────────────────

const MenuStep: React.FC<{ storeId: string; onComplete: () => void }> = ({ storeId, onComplete }) => {
  const [menus, setMenus] = useState<any[]>([]);
  const [menuName, setMenuName] = useState('Main Menu');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    menuAPI.list(storeId).then(setMenus).catch(() => {});
  }, [storeId]);

  const createMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const menu = await menuAPI.create({ storeId, name: menuName, isDefault: menus.length === 0 });
      setMenus([...menus, menu]);
      setMenuName('');
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err?.response?.data?.message ?? 'Failed to create menu');
    } finally {
      setSaving(false);
    }
  };

  return (
    <StepCard
      title="Menu Setup"
      description="Create at least one menu. You can add categories and items now, or add them later from the Menu Manager."
    >
      {menus.length > 0 && (
        <div className="mb-4 space-y-2">
          {menus.map((m) => (
            <div key={m.id} className="flex items-center gap-3 bg-success-50 border border-success-200 rounded-lg px-3 py-2.5">
              <CheckCircleIcon size={16} className="text-success-600" />
              <p className="text-sm font-medium text-neutral-900">{m.name}</p>
              {m.isDefault && <Badge variant="success" size="sm">Default</Badge>}
            </div>
          ))}
        </div>
      )}

      <form onSubmit={createMenu} className="space-y-4">
        <div>
          <label className="field-label">Menu Name <span className="text-error-600">*</span></label>
          <Input value={menuName} onChange={(e) => setMenuName(e.target.value)} placeholder="Main Menu" required />
        </div>
        {error && <ErrorBanner>{error}</ErrorBanner>}
        <div className="flex gap-3">
          <Button type="submit" variant="secondary" loading={saving} disabled={!menuName.trim() || saving}>
            Create Menu
          </Button>
          {menus.length > 0 && (
            <Button type="button" variant="primary" onClick={onComplete}>
              Continue <ChevronRightIcon size={16} />
            </Button>
          )}
        </div>
      </form>
    </StepCard>
  );
};

// ─── Step: Inventory ──────────────────────────────────────────────────────────

const InventoryStep: React.FC<{ storeId: string; onComplete: () => void }> = ({ onComplete }) => {
  return (
    <StepCard
      title="Inventory Setup"
      description="You can configure inventory items now or set them up later from the Inventory Manager. Inventory tracks your raw ingredients and supplies."
    >
      <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-neutral-700 font-medium">You can skip this step</p>
        <p className="text-xs text-neutral-500 mt-1">
          Inventory configuration is optional during setup. Once the restaurant is live, use the Inventory page to add products, set stock levels, and configure reorder alerts.
        </p>
      </div>
      <StepFooter>
        <Button variant="ghost" onClick={onComplete} className="text-muted-foreground">
          Skip for now
        </Button>
        <Button variant="primary" onClick={onComplete}>
          Continue <ChevronRightIcon size={16} />
        </Button>
      </StepFooter>
    </StepCard>
  );
};

// ─── Step: Payment ────────────────────────────────────────────────────────────

const PaymentStep: React.FC<{ storeId: string; onComplete: () => void }> = ({ storeId, onComplete }) => {
  const [cashEnabled, setCashEnabled] = useState(true);
  const [cardEnabled, setCardEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    onboardingAPI.getPaymentConfig(storeId).then((cfg) => {
      if (cfg) {
        setCashEnabled(cfg.cashEnabled);
        setCardEnabled(cfg.cardEnabled);
      }
    }).catch(() => {});
  }, [storeId]);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const methods = [];
      if (cashEnabled) methods.push('cash');
      if (cardEnabled) methods.push('card');
      await onboardingAPI.setPaymentConfig(storeId, { cashEnabled, cardEnabled, enabledMethods: methods });
      onComplete();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err?.response?.data?.message ?? 'Failed to save payment config');
    } finally {
      setSaving(false);
    }
  };

  return (
    <StepCard
      title="Payment Methods"
      description="Choose which payment methods your restaurant accepts. You can change these at any time."
    >
      <div className="space-y-3 mb-6">
        {[
          { key: 'cash', label: 'Cash', desc: 'Accept cash payments at the counter', enabled: cashEnabled, setEnabled: setCashEnabled },
          { key: 'card', label: 'Card / Tap to Pay', desc: 'Credit, debit, and contactless payments', enabled: cardEnabled, setEnabled: setCardEnabled },
        ].map((m) => (
          <label key={m.key} className={cn(
            'flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-colors',
            m.enabled ? 'border-primary-500 bg-primary-50' : 'border-neutral-200 bg-white',
          )}>
            <input
              type="checkbox"
              className="sr-only"
              checked={m.enabled}
              onChange={(e) => m.setEnabled(e.target.checked)}
            />
            <div className={cn('w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
              m.enabled ? 'bg-primary-600 border-primary-600' : 'border-neutral-300',
            )}>
              {m.enabled && <CheckCircleIcon size={12} className="text-white" />}
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-900">{m.label}</p>
              <p className="text-xs text-muted-foreground">{m.desc}</p>
            </div>
          </label>
        ))}
      </div>
      {error && <ErrorBanner className="mb-4">{error}</ErrorBanner>}
      <StepFooter>
        <Button variant="primary" onClick={save} loading={saving} disabled={saving || (!cashEnabled && !cardEnabled)}>
          Save & Continue <ChevronRightIcon size={16} />
        </Button>
      </StepFooter>
    </StepCard>
  );
};

// ─── Step: Notifications ──────────────────────────────────────────────────────

const NotificationsStep: React.FC<{ storeId: string; onComplete: () => void }> = ({ storeId, onComplete }) => {
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [lowStock, setLowStock] = useState(true);
  const [orderAlerts, setOrderAlerts] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await onboardingAPI.setNotificationConfig(storeId, {
        managerPhone: phone || undefined,
        managerEmail: email || undefined,
        lowStockAlerts: lowStock,
        orderAlerts,
        channels: phone ? ['whatsapp'] : email ? ['email'] : [],
      });
      onComplete();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err?.response?.data?.message ?? 'Failed to save notification config');
    } finally {
      setSaving(false);
    }
  };

  return (
    <StepCard
      title="Notifications & Alerts"
      description="Set up where you want to receive alerts for low stock, new orders, and system events."
    >
      <div className="space-y-4 mb-6">
        <div>
          <label className="field-label">Manager WhatsApp / Phone</label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+971 50 XXX XXXX" type="tel" />
        </div>
        <div>
          <label className="field-label">Manager Email</label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="manager@restaurant.com" type="email" />
        </div>
        <div className="space-y-2">
          {[
            { label: 'Low Stock Alerts', desc: 'Notify when inventory items fall below reorder level', checked: lowStock, set: setLowStock },
            { label: 'Order Alerts', desc: 'Notify on order completion and issues', checked: orderAlerts, set: setOrderAlerts },
          ].map((a) => (
            <label key={a.label} className="flex items-center gap-3 p-3 rounded-lg border border-neutral-200 cursor-pointer hover:bg-neutral-50">
              <input
                type="checkbox"
                className="w-4 h-4 accent-primary-600"
                checked={a.checked}
                onChange={(e) => a.set(e.target.checked)}
              />
              <div>
                <p className="text-sm font-medium text-neutral-800">{a.label}</p>
                <p className="text-xs text-muted-foreground">{a.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>
      {error && <ErrorBanner className="mb-4">{error}</ErrorBanner>}
      <StepFooter>
        <Button variant="ghost" onClick={onComplete} className="text-muted-foreground">
          Skip
        </Button>
        <Button variant="primary" onClick={save} loading={saving} disabled={saving}>
          Finish Setup <PartyPopperIcon size={16} />
        </Button>
      </StepFooter>
    </StepCard>
  );
};

// ─── Shared sub-components ────────────────────────────────────────────────────

const StepCard: React.FC<{ title: string; description: string; children: React.ReactNode }> = ({ title, description, children }) => (
  <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
    <h2 className="text-lg font-bold text-neutral-900 mb-1">{title}</h2>
    <p className="text-sm text-muted-foreground mb-6">{description}</p>
    {children}
  </div>
);

const StepFooter: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-100 mt-6">{children}</div>
);

const ErrorBanner: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={cn('bg-error-50 border border-error-200 text-error-700 text-sm rounded-lg px-3 py-2', className)}>
    {children}
  </div>
);
