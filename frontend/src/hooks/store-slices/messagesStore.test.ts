import { beforeEach, describe, expect, it, vi } from 'vitest';
import { create } from 'zustand';
import type { StoreState } from '../useStore';
import type { IMember } from '@/models/member.model';
import type { IMessage } from '@/models/messages.model';
import { createMessageSlice } from './messagesStore';
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

const mockFetchAPI = vi.mocked(fetchAPI);

type TestMessagesStore = {
  getState: () => StoreState;
  setState: (partial: Partial<StoreState>) => void;

  updateLastMessages: (updates: Record<string, IMessage | null>) => void;
  setSelectedUser: (user: IMember | null) => void;
  getMessages: (userId: string | null) => Promise<void>;
  sendMessage: (messageData: IMessage | FormData | null) => Promise<void>;
  subscribeToMessages: () => void;
  unsubscribeFromMessages: () => void;

  memberLogout: ReturnType<typeof vi.fn>;
};

describe('Messages Slice', () => {
  let useStore: TestMessagesStore;
  let storeInstance: any;

  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) =>
      key === 'lh_token' ? 'fake-token' : null,
    );

    storeInstance = create<StoreState>((set, get, api) => ({
      ...(createMessageSlice(set, get, api) as any),

      memberLogout: vi.fn(),
      loggedInMember: { _id: 'currentUser123' } as IMember,
      socket: { off: vi.fn(), on: vi.fn() },
    }));

    useStore = {
      getState: storeInstance.getState,
      setState: storeInstance.setState,

      updateLastMessages: storeInstance.getState().updateLastMessages,
      setSelectedUser: storeInstance.getState().setSelectedUser,
      getMessages: storeInstance.getState().getMessages,
      sendMessage: storeInstance.getState().sendMessage,
      subscribeToMessages: storeInstance.getState().subscribeToMessages,
      unsubscribeFromMessages: storeInstance.getState().unsubscribeFromMessages,

      memberLogout: storeInstance.getState().memberLogout,
    };
  });

  it('should have correct initial state', () => {
    const state = useStore.getState();

    expect(state.messages).toEqual([]);
    expect(state.selectedUser).toBeNull();
    expect(state.isMessagesLoading).toBe(false);
    expect(state.lastMessages).toEqual({});
  });

  describe('updateLastMessages', () => {
    it('should merge new last messages', () => {
      const updates: Record<string, IMessage | null> = {
        friend456: { _id: 'msg1', text: 'Hello' } as IMessage,
      };

      useStore.updateLastMessages(updates);

      expect(useStore.getState().lastMessages['friend456']).toEqual(updates['friend456']);
    });
  });

  describe('setSelectedUser', () => {
    it('should set user, clear messages and call getMessages', async () => {
      const mockUser: IMember = { _id: 'friend456', username: 'friend' } as IMember;

      // Setup mock response BEFORE calling setSelectedUser
      mockFetchAPI.mockResolvedValueOnce(mockAxiosResponse([]));

      // Spy on the real getMessages from the store
      const getMessagesSpy = vi.spyOn(storeInstance.getState(), 'getMessages');

      useStore.setSelectedUser(mockUser);

      const state = useStore.getState();

      expect(state.selectedUser).toEqual(mockUser);
      expect(state.messages).toEqual([]);

      expect(getMessagesSpy).toHaveBeenCalledWith('friend456');
    });

    it('should clear selection and unsubscribe when null is passed', () => {
      const unsubscribeSpy = vi.spyOn(storeInstance.getState(), 'unsubscribeFromMessages');

      useStore.setSelectedUser(null);

      expect(useStore.getState().selectedUser).toBeNull();
      expect(unsubscribeSpy).toHaveBeenCalled();
    });
  });

  describe('getMessages', () => {
    it('should fetch messages successfully', async () => {
      const mockMessages: IMessage[] = [
        {
          _id: 'm1',
          text: 'Hi there',
          senderId: 'friend456',
          recipientId: 'currentUser123',
        } as IMessage,
      ];

      mockFetchAPI.mockResolvedValueOnce(mockAxiosResponse(mockMessages));

      await useStore.getMessages('friend456');

      const state = useStore.getState();
      expect(state.messages).toEqual(mockMessages);
      expect(state.isMessagesLoading).toBe(false);
    });
  });

  describe('sendMessage', () => {
    it('should send message and update both messages and lastMessages', async () => {
      const mockNewMessage: IMessage = {
        _id: 'new123',
        text: 'Test message',
        senderId: 'currentUser123',
        recipientId: 'friend456',
      } as IMessage;

      useStore.setState({
        selectedUser: { _id: 'friend456' } as IMember,
        messages: [],
      } as any);

      mockFetchAPI.mockResolvedValueOnce(mockAxiosResponse(mockNewMessage));

      await useStore.sendMessage({ text: 'Test message' } as IMessage);

      const state = useStore.getState();
      expect(state.messages).toHaveLength(1);
      expect(state.lastMessages['friend456']).toEqual(mockNewMessage);
    });
  });

  describe('subscribeToMessages', () => {
    it('should register newMessage socket listener', () => {
      useStore.subscribeToMessages();

      const socket = useStore.getState().socket as any;
      expect(socket.off).toHaveBeenCalledWith('newMessage');
      expect(socket.on).toHaveBeenCalledWith('newMessage', expect.any(Function));
    });
  });
});
