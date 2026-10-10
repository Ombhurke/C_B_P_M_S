import { Shop, QueueItem, Summary, ActivityEvent, Printer } from '@/lib/types';

export type CounterDeskTab = 'overview' | 'queue' | 'printers' | 'rates' | 'team';

export interface Station {
  id: string;
  shop_id: string;
  name: string;
  location: string;
  status: 'online' | 'offline' | 'busy';
  assigned_printer_id?: string;
  last_sync?: string;
}

export interface TeamMember {
  username: string;
  shop_id: string;
  role: 'admin' | 'operator';
  active: boolean;
  last_active?: string;
}

export interface CounterDeskContextType {
  shop: Shop;
  queue: QueueItem[];
  summary: Summary | null;
  activity: ActivityEvent[];
  stations: Station[];
  team: TeamMember[];
  activeTab: CounterDeskTab;
  setActiveTab: (tab: CounterDeskTab) => void;
  selectedJobId: string | null;
  setSelectedJobId: (id: string | null) => void;
  viewingJobDetail: boolean;
  setViewingJobDetail: (val: boolean) => void;
  refreshData: () => Promise<void>;
  token: string;
}
