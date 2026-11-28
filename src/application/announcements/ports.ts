export interface DockOption {
  id: string;
  code: string;
  name: string;
}

export interface AnnouncementRecord {
  id: string;
  dockId: string | null;
  dockName: string | null;
  title: string;
  message: string;
  startsAt: Date;
  endsAt: Date | null;
  createdById: string;
  createdByName: string;
}

export interface ActiveDockSuspensionRecord {
  id: string;
  dockId: string;
  dockName: string;
  reason: string;
  startsAt: Date;
  endsAt: Date | null;
}

export interface CreateAnnouncementData {
  dockId: string | null;
  title: string;
  message: string;
  startsAt: Date;
  endsAt: Date | null;
  createdById: string;
}

export interface AnnouncementRepository {
  listDocks(): Promise<DockOption[]>;
  publish(data: CreateAnnouncementData): Promise<AnnouncementRecord>;
  closeEarly(announcementId: string, adminId: string, closedAt: Date): Promise<AnnouncementRecord>;
  listAdminAnnouncements(): Promise<AnnouncementRecord[]>;
  listActivePassengerNotices(now: Date): Promise<{
    announcements: AnnouncementRecord[];
    suspensions: ActiveDockSuspensionRecord[];
  }>;
}
