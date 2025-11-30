export type ShortcutAction = 'search' | 'new' | 'help' | 'close' | 'navigate-subscriptions' | 'navigate-products' | 'navigate-dashboard';

export interface Shortcut {
  key: string;
  ctrlKey: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  action: ShortcutAction;
  description: string;
  category: 'navigation' | 'actions' | 'ui';
}

export const SHORTCUTS: Shortcut[] = [
  {
    key: 'k',
    ctrlKey: true,
    action: 'search',
    description: 'فتح البحث السريع',
    category: 'ui',
  },
  {
    key: 'n',
    ctrlKey: true,
    action: 'new',
    description: 'إنشاء عنصر جديد',
    category: 'actions',
  },
  {
    key: '?',
    ctrlKey: true,
    action: 'help',
    description: 'عرض الاختصارات',
    category: 'ui',
  },
  {
    key: 'Escape',
    ctrlKey: false,
    action: 'close',
    description: 'إغلاق النوافذ المنبثقة',
    category: 'ui',
  },
  {
    key: '1',
    ctrlKey: true,
    action: 'navigate-dashboard',
    description: 'الذهاب إلى لوحة التحكم',
    category: 'navigation',
  },
  {
    key: '2',
    ctrlKey: true,
    action: 'navigate-products',
    description: 'الذهاب إلى المنتجات',
    category: 'navigation',
  },
  {
    key: '3',
    ctrlKey: true,
    action: 'navigate-subscriptions',
    description: 'الذهاب إلى الاشتراكات',
    category: 'navigation',
  },
];

export function isShortcutMatch(
  event: KeyboardEvent,
  shortcut: Shortcut
): boolean {
  const keyMatch =
    event.key.toLowerCase() === shortcut.key.toLowerCase() ||
    event.code === shortcut.key;

  const ctrlMatch = shortcut.ctrlKey
    ? event.ctrlKey || event.metaKey
    : !event.ctrlKey && !event.metaKey;

  const shiftMatch = shortcut.shiftKey
    ? event.shiftKey
    : !event.shiftKey;

  const altMatch = shortcut.altKey
    ? event.altKey
    : !event.altKey;

  return keyMatch && ctrlMatch && shiftMatch && altMatch;
}

export function getShortcutDisplay(shortcut: Shortcut): string {
  const parts: string[] = [];

  if (shortcut.ctrlKey) {
    parts.push(navigator.platform.includes('Mac') ? '⌘' : 'Ctrl');
  }
  if (shortcut.shiftKey) {
    parts.push('Shift');
  }
  if (shortcut.altKey) {
    parts.push('Alt');
  }

  const displayKey =
    shortcut.key === 'Escape'
      ? 'Esc'
      : shortcut.key === '?'
        ? 'Shift+?'
        : shortcut.key.toUpperCase();

  parts.push(displayKey);
  return parts.join(' + ');
}
