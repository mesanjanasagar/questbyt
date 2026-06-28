import React from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '../cn';
import { QuestbytLogo, LogOutIcon } from '../icons';

export interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  badge?: string | number;
  exact?: boolean;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

interface SidebarProps {
  appName: string;
  appDescription?: string;
  navGroups: NavGroup[];
  onLogout?: () => void;
  username?: string;
  userRole?: string;
  userAvatar?: string;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export function Sidebar({
  appName,
  appDescription,
  navGroups,
  onLogout,
  username,
  userRole,
  collapsed = false,
}: SidebarProps) {
  return (
    <aside
      className={cn(
        'flex flex-col h-screen bg-brand-900 text-white',
        'border-r border-brand-800',
        'transition-all duration-200 ease-out',
        collapsed ? 'w-16' : 'w-60',
        'flex-shrink-0',
      )}
    >
      {/* Brand Header */}
      <div
        className={cn(
          'flex items-center gap-3 px-4 py-5',
          'border-b border-brand-800/60',
          collapsed && 'justify-center px-0',
        )}
      >
        <QuestbytLogo size={28} className="flex-shrink-0" />
        {!collapsed && (
          <div className="min-w-0">
            <p className="font-bold text-white text-sm leading-none tracking-tight">
              {appName}
            </p>
            {appDescription && (
              <p className="text-brand-400 text-xs mt-0.5 leading-none truncate">
                {appDescription}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {navGroups.map((group, gi) => (
          <div key={gi}>
            {group.label && !collapsed && (
              <p className="text-brand-500 text-xs font-semibold uppercase tracking-label px-2 mb-1.5">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.exact ?? item.path === '/'}
                  className={({ isActive }: { isActive: boolean }) =>
                    cn(
                      'flex items-center gap-3 px-2.5 py-2 rounded-lg transition-all duration-150',
                      'text-sm font-medium group relative',
                      collapsed && 'justify-center px-0',
                      isActive
                        ? 'bg-primary-600 text-white shadow-sm'
                        : 'text-brand-300 hover:bg-brand-800/80 hover:text-white',
                    )
                  }
                  title={collapsed ? item.label : undefined}
                >
                  {({ isActive }: { isActive: boolean }) => (
                    <>
                      <span
                        className={cn(
                          'flex-shrink-0 transition-colors',
                          isActive ? 'text-white' : 'text-brand-400 group-hover:text-white',
                        )}
                      >
                        {item.icon}
                      </span>
                      {!collapsed && (
                        <>
                          <span className="flex-1 truncate">{item.label}</span>
                          {item.badge !== undefined && (
                            <span
                              className={cn(
                                'ml-auto flex-shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center',
                                isActive
                                  ? 'bg-white/20 text-white'
                                  : 'bg-brand-700 text-brand-300',
                              )}
                            >
                              {item.badge}
                            </span>
                          )}
                        </>
                      )}
                      {collapsed && item.badge !== undefined && (
                        <span className="absolute top-0 right-0 w-2 h-2 bg-primary-500 rounded-full" />
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* User Footer */}
      {(username || onLogout) && (
        <div className={cn('border-t border-brand-800/60 p-2', collapsed && 'px-0')}>
          {username && !collapsed && (
            <div className="flex items-center gap-3 px-2.5 py-2 mb-1">
              <div className="w-7 h-7 rounded-full bg-brand-700 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-brand-300 uppercase">
                  {username.charAt(0)}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white truncate">{username}</p>
                {userRole && (
                  <p className="text-xs text-brand-400 truncate">{userRole}</p>
                )}
              </div>
            </div>
          )}
          {onLogout && (
            <button
              onClick={onLogout}
              className={cn(
                'flex items-center gap-3 w-full px-2.5 py-2 rounded-lg',
                'text-sm font-medium text-brand-400 hover:text-white hover:bg-brand-800',
                'transition-colors duration-150',
                collapsed && 'justify-center px-0',
              )}
              title={collapsed ? 'Sign out' : undefined}
            >
              <LogOutIcon size={16} className="flex-shrink-0" />
              {!collapsed && <span>Sign out</span>}
            </button>
          )}
        </div>
      )}
    </aside>
  );
}
