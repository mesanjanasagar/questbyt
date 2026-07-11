import { useEffect, useRef, useState } from 'react';
import { BellIcon, XIcon, CheckIcon, TrashIcon } from '@pos/ui';
import { useNotificationStore } from '../store/notificationStore';

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

export function NotificationBell() {
  const { notifications, markRead, markAllRead, dismiss, clear } = useNotificationStore();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-1 rounded text-brand-300 hover:text-white hover:bg-brand-800/60 transition-colors"
        aria-label="Notifications"
      >
        <BellIcon size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-error-500 text-white text-[10px] font-bold leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-[70vh] flex flex-col bg-white rounded-xl shadow-2xl border border-neutral-200 overflow-hidden z-50 text-neutral-900">
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
            <span className="font-bold text-sm">Notifications</span>
            {notifications.length > 0 && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => markAllRead()}
                  className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 font-medium"
                >
                  <CheckIcon size={12} /> Mark all read
                </button>
                <button
                  onClick={() => clear()}
                  className="flex items-center gap-1 text-xs text-neutral-400 hover:text-error-600 font-medium"
                >
                  <TrashIcon size={12} /> Clear
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                <BellIcon size={28} className="text-neutral-300 mb-2" />
                <p className="text-sm text-neutral-500">No notifications yet</p>
                <p className="text-xs text-neutral-400 mt-0.5">Ready orders will show up here.</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  className={`flex items-start gap-2 px-4 py-3 border-b border-neutral-50 cursor-pointer hover:bg-neutral-50 transition-colors ${
                    n.read ? '' : 'bg-primary-50/50'
                  }`}
                >
                  {!n.read && <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary-600 shrink-0" />}
                  <div className={`flex-1 min-w-0 ${n.read ? 'pl-3.5' : ''}`}>
                    <p className="text-sm font-semibold leading-tight text-neutral-800">{n.title}</p>
                    <p className="text-xs text-neutral-500 mt-0.5">{n.message}</p>
                    <p className="text-[10px] text-neutral-400 mt-1">{timeAgo(n.createdAt)}</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      dismiss(n.id);
                    }}
                    className="shrink-0 text-neutral-300 hover:text-neutral-600 transition-colors"
                    aria-label="Dismiss"
                  >
                    <XIcon size={13} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
