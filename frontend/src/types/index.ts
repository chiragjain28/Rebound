export interface User {
  username: string;
  name: string;
  role: string;
}

export interface Table {
  id: number;
  number: number;
  gameType?: string;
  status: string; // 'available', 'occupied'
}

export interface MenuItem {
  id: number;
  name: string;
  price: number;
  category: string; // 'Cafe', 'Cold Drinks', 'Cigarettes'
}

export interface Session {
  id: string;
  tableId?: number;
  table?: Table;
  customerName: string;
  customerPhone?: string;
  gameType: string;   // 'Pool', 'MidSnooker', 'PS4', 'None'
  playerCount: number;
  startTime: string;
  endTime?: string;
  status: string;     // 'active', 'completed'
  staffUsername: string;
  totalBill: number;
  gameCost: number;
  menuCost: number;
  customAmount: number; // positive = extra charge, negative = discount
  paymentStatus: string; // 'pending', 'paid', 'partially_paid', 'udhar'
  orders?: Order[];
  payments?: Payment[];
  udhars?: Udhar[];
  tablePlays?: TablePlay[];
  priorUdhar?: number;
}

export interface TablePlay {
  id: number;
  sessionId: string;
  tableId?: number;
  table?: Table;
  gameType: string;     // 'Pool', 'MidSnooker', 'PS4'
  playerCount: number;
  startTime: string;
  endTime?: string;
  cost: number;
  createdBy: string;
}

export interface Order {
  id: number;
  sessionId: string;
  menuItemId: number;
  menuItem?: MenuItem;
  quantity: number;
  price: number;
  createdAt: string;
}

export interface Payment {
  id: number;
  sessionId: string;
  amount: number;
  method: string; // 'Cash', 'UPI'
  createdAt: string;
}

export interface Udhar {
  id: number;
  customerName: string;
  amount: number;
  sessionId?: string;
  session?: Session;
  status: string; // 'unpaid', 'paid'
  createdAt: string;
}

export interface TableBooking {
  id: number;
  tableId: number;
  table?: Table;
  customerName: string;
  contactNumber?: string;
  bookingTime: string;
  createdAt: string;
}
