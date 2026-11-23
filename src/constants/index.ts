import { ShopConfig, User } from '../types';

export const BRANDS = [
  'All',
  'Vivo',
  'Oppo',
  'Samsung',
  'Apple',
  'Xiaomi',
  'Realme',
  'OnePlus',
  'Motorola',
  'Nothing',
  'Tecno',
  'Infinix',
  'Others',
] as const;

export const DEFAULT_SHOP_CONFIG: ShopConfig = {
  shopName: 'Parth Mobile Care',
  tagline: 'Staff & Customer Management System',
  shopAddress: 'Parth Mobile Care, Ahmedabad, Gujarat',
  phone: '+91 98765 43210',
  alternatePhone: '+91 98765 43211',
  email: 'parthmobilecare@gmail.com',
  gstNumber: '24ABCDE1234F1Z5',
  // Store Attendance Geofence Coordinates
  latitude: 23.032588,
  longitude: 72.661115,
  allowedRadiusMeters: 30, // 30 meters per PDF requirements
  openingTime: '10:00', // 10:00 AM
  closingTime: '21:00', // 09:00 PM
};

export const INITIAL_USERS: User[] = [
  {
    id: 'user_admin_1',
    name: 'Parth Patel',
    email: 'parthmobilecare07@gmail.com',
    phone: '9876543210',
    role: 'admin',
    designation: 'Store Owner & Admin',
    joinedDate: '2023-01-01',
    basicSalary: 60000,
    monthlyTarget: 500000,
    isActive: true,
  },
  {
    id: 'user_mgr_1',
    name: 'Rahul Sharma',
    email: 'manager@parthmobile.com',
    phone: '9876543211',
    role: 'staff',
    designation: 'Floor Manager',
    joinedDate: '2023-06-15',
    basicSalary: 35000,
    monthlyTarget: 350000,
    isActive: true,
  },
  {
    id: 'user_staff_1',
    name: 'Ankit Verma',
    email: 'ankit@parthmobile.com',
    phone: '9876543212',
    role: 'staff',
    designation: 'Sales Executive',
    joinedDate: '2024-01-10',
    basicSalary: 20000,
    monthlyTarget: 200000,
    isActive: true,
  },
  {
    id: 'user_staff_2',
    name: 'Pooja Mehta',
    email: 'pooja@parthmobile.com',
    phone: '9876543213',
    role: 'staff',
    designation: 'Customer Relationship Exec',
    joinedDate: '2024-03-01',
    basicSalary: 22000,
    monthlyTarget: 220000,
    isActive: true,
  },
];

// Re-export canonical THEME_COLORS from central theme system for backward compatibility
export { THEME_COLORS } from '../theme/colors';

