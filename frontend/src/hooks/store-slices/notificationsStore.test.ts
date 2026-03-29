import { beforeEach, describe, expect, it, vi } from 'vitest';
import { create } from 'zustand';
import type { StoreState } from '../useStore';
import type { INotification } from '@/models/notification.model';
import { createNotificationSlice } from './notificationsStore';
import { mockAxiosResponse } from '@/__mocks__/mocks';

vi.mock('@/utils/index', () => ({
  fetchAPI: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

import { fetchAPI } from '@/utils/index';
import { toast } from 'sonner';

const mockFetchAPI = vi.mocked(fetchAPI);
const mockToastError = vi.mocked(toast.error);

type TestNotificationsStore = {
  getState: () => StoreState;
  setState: (partial: Partial<StoreState>) => void;

  getNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  subscribeToNotifications: () => void;
  unsubscribeFromNotifications: () => void;

  memberLogout?: ReturnType<typeof vi.fn>;
};

describe('Notifications Slice', () => {
  let useStore: TestNotificationsStore;
  let storeInstance: any;

  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) =>
      key === 'lh_token' ? 'fake-token' : null,
    );
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {});

    storeInstance = create<StoreState>((set, get, api) => ({
      ...(createNotificationSlice(set, get, api) as any),

      socket: {
        off: vi.fn(),
        on: vi.fn(),
      },
    }));

    useStore = {
      getState: storeInstance.getState,
      setState: storeInstance.setState,

      getNotifications: storeInstance.getState().getNotifications,
      markAsRead: storeInstance.getState().markAsRead,
      markAllAsRead: storeInstance.getState().markAllAsRead,
      subscribeToNotifications: storeInstance.getState().subscribeToNotifications,
      unsubscribeFromNotifications: storeInstance.getState().unsubscribeFromNotifications,
    };
  });

  it('should have correct initial state', () => {
    const state = useStore.getState();

    expect(state.notifications).toEqual([]);
    expect(state.unreadCount).toBe(0);
    expect(state.isLoading).toBe(false);
  });

  describe('getNotifications', () => {
    it('should fetch notifications and calculate unread count', async () => {
      const mockNotifications: INotification[] = [
        { _id: 'n1', message: 'New message', isRead: false } as INotification,
        { _id: 'n2', message: 'Old message', isRead: true } as INotification,
      ];

      mockFetchAPI.mockResolvedValueOnce(mockAxiosResponse(mockNotifications));

      await useStore.getNotifications();

      const state = useStore.getState();
      expect(state.notifications).toEqual(mockNotifications);
      expect(state.unreadCount).toBe(1); // only one unread
      expect(state.isLoading).toBe(false);
    });

    it('should handle error gracefully', async () => {
      mockFetchAPI.mockRejectedValueOnce({
        response: { data: { message: 'Failed to load' } },
      });

      await useStore.getNotifications();

      expect(mockToastError).toHaveBeenCalledWith('Failed to load');
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read and update unread count', async () => {
      const initialNotifications: INotification[] = [
        { _id: 'n1', message: 'Test', isRead: false } as INotification,
        { _id: 'n2', message: 'Test2', isRead: false } as INotification,
      ];

      useStore.setState({ notifications: initialNotifications, unreadCount: 2 } as any);

      mockFetchAPI.mockResolvedValueOnce(mockAxiosResponse({}));

      await useStore.markAsRead('n1');

      const state = useStore.getState();
      expect(state.notifications[0].isRead).toBe(true);
      expect(state.unreadCount).toBe(1);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read and reset unread count', async () => {
      const initialNotifications: INotification[] = [
        { _id: 'n1', isRead: false } as INotification,
        { _id: 'n2', isRead: false } as INotification,
      ];

      useStore.setState({ notifications: initialNotifications, unreadCount: 2 } as any);

      mockFetchAPI.mockResolvedValueOnce(mockAxiosResponse({}));

      await useStore.markAllAsRead();

      const state = useStore.getState();
      expect(state.notifications.every((n) => n.isRead)).toBe(true);
      expect(state.unreadCount).toBe(0);
    });
  });

  describe('subscribeToNotifications', () => {
    it('should register notification listener on socket', () => {
      useStore.subscribeToNotifications();

      const socket = useStore.getState().socket as any;
      expect(socket.off).toHaveBeenCalledWith('notification');
      expect(socket.on).toHaveBeenCalledWith('notification', expect.any(Function));
    });
  });

  describe('unsubscribeFromNotifications', () => {
    it('should remove notification listener', () => {
      useStore.unsubscribeFromNotifications();

      const socket = useStore.getState().socket as any;
      expect(socket.off).toHaveBeenCalledWith('notification');
    });
  });
});
