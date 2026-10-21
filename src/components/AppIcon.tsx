import React from 'react';
import {
  Archive,
  BarChart3,
  Bell,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  FileText,
  Home,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  Plus,
  Search,
  Settings,
  ShoppingCart,
  Smartphone,
  Tag,
  Trash2,
  Upload,
  UserRound,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react-native';

export type AppIconName =
  | 'archive' | 'analytics' | 'bell' | 'calendar' | 'camera' | 'check'
  | 'chevron-left' | 'clock' | 'file' | 'home' | 'location' | 'message' | 'package' | 'phone' | 'plus'
  | 'search' | 'settings' | 'cart' | 'smartphone' | 'tag' | 'trash'
  | 'upload' | 'user' | 'users' | 'wallet' | 'error';

const ICONS = {
  archive: Archive,
  analytics: BarChart3,
  bell: Bell,
  calendar: CalendarDays,
  camera: Camera,
  check: CheckCircle2,
  'chevron-left': ChevronLeft,
  clock: Clock3,
  file: FileText,
  home: Home,
  location: MapPin,
  message: MessageCircle,
  package: Package,
  phone: Phone,
  plus: Plus,
  search: Search,
  settings: Settings,
  cart: ShoppingCart,
  smartphone: Smartphone,
  tag: Tag,
  trash: Trash2,
  upload: Upload,
  user: UserRound,
  users: Users,
  wallet: Wallet,
  error: XCircle,
} as const;

interface AppIconProps {
  name: AppIconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export const AppIcon: React.FC<AppIconProps> = ({
  name,
  size = 18,
  color = '#6B7280',
  strokeWidth = 2,
}) => {
  const Icon = ICONS[name];
  return <Icon size={size} color={color} strokeWidth={strokeWidth} />;
};
