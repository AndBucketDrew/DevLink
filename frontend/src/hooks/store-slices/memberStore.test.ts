import { beforeEach, describe, expect, it, vi } from 'vitest';
import { create } from 'zustand';
import type { StoreState } from '../useStore';
import { createMemberSlice } from './memberStore';
import { fetchAPI } from '@/utils';
import { jwtDecode } from 'jwt-decode';
import { io } from 'socket.io-client';

vi.mock('@/utils/index', () => ({
  fetchAPI: vi.fn(),
}));

vi.mock('jwt-decode', () => ({
  jwtDecode: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock('socket.io-client', () => ({
  io: vi.fn().mockReturnValue({
    on: vi.fn(),
    disconnect: vi.fn(),
    connected: false,
  }),
}));

// Type-safe mocked functions - using vi.mocked like in your friends test
const mockFetchAPI = vi.mocked(fetchAPI);
const mockJwtDecode = vi.mocked(jwtDecode); // direct import
const mockIO = vi.mocked(io); // direct import from mocked module

describe('Member Slice', () => {
  let useStore: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Set default token so most tests don't fail on "Not logged in"
    localStorage.setItem('lh_token', 'fake-token');

    useStore = create<StoreState>((set, get, store) => ({
      // Same pattern as your friendsStore test
      ...(createMemberSlice(set, get, store) as any),

      // Mock cross-slice methods called inside member slice
      subscribeToMessages: vi.fn(),
      unsubscribeFromMessages: vi.fn(),
      subscribeToNotifications: vi.fn(),

      // Dummy states to prevent runtime errors
      selectedUser: null,
      memberPosts: [],
      relationshipStatus: 'none',
      isSender: false,
    })) as any;
  });

  it('should initialize with correct default state', () => {
    const state = useStore.getState();

    expect(state.member).toEqual(expect.objectContaining({ _id: '', username: '' }));
    expect(state.user).toEqual(expect.objectContaining({ _id: '', username: '' }));
    expect(state.loggedInMember).toBeNull();
    expect(state.token).toBeNull();
    expect(state.loading).toBe(false);
    expect(state.isUpdatingProfile).toBe(false);
    expect(state.friendsSearchResults).toEqual([]);
    expect(state.wideSearchResults).toEqual([]);
  });

  describe('memberLogin', () => {
    it('should successfully login and set token + loggedInMember', async () => {
      vi.spyOn(Storage.prototype, 'setItem');
      const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake.token';
      const mockDecoded = { id: 'user123', exp: Math.floor(Date.now() / 1000) + 3600 };
      const mockMember = {
        _id: 'user123',
        username: 'testuser',
        email: 'test@example.com',
      };

      mockJwtDecode.mockReturnValue(mockDecoded);

      mockFetchAPI
        .mockResolvedValueOnce({ status: 200, data: mockToken }) // login endpoint
        .mockResolvedValueOnce({ data: mockMember }); // fetch member by id

      const success = await useStore.getState().memberLogin({
        username: 'testuser',
        password: 'password123',
      });

      expect(success).toBe(true);
      expect(useStore.getState().token).toBe(mockToken);
      expect(useStore.getState().loggedInMember).toEqual(mockMember);
      expect(localStorage.setItem).toHaveBeenCalledWith('lh_token', mockToken);
    });
  });

  it('should clear localStorage and reset state', () => {
    vi.spyOn(Storage.prototype, 'removeItem');

    useStore.setState({
      token: 'old-token',
      loggedInMember: { _id: '123' } as any,
    });

    useStore.getState().memberLogout();

    expect(localStorage.removeItem).toHaveBeenCalledWith('lh_token');
    expect(localStorage.removeItem).toHaveBeenCalledWith('lh_member');
    expect(localStorage.removeItem).toHaveBeenCalledWith('chat-storage');

    const state = useStore.getState();
    expect(state.token).toBeNull();
    expect(state.loggedInMember).toBeNull();
  });
  describe('editProfile', () => {
    it('should update profile and refresh member data', async () => {
      const mockUpdatedMember = { _id: '123', username: 'updateduser' };

      useStore.setState({
        loggedInMember: { _id: '123' },
        token: 'fake-token',
      });

      mockFetchAPI
        .mockResolvedValueOnce({}) // patch /members/:id
        .mockResolvedValueOnce({ data: mockUpdatedMember }); // memberRefreshMe

      const success = await useStore.getState().editProfile({ firstName: 'NewName' });

      expect(success).toBe(true);
      expect(useStore.getState().isUpdatingProfile).toBe(false);
    });
  });

  describe('connectSocket', () => {
    it('should initialize socket with correct userId', () => {
      useStore.setState({
        loggedInMember: { _id: 'user123' } as any,
      });

      useStore.getState().connectSocket();

      expect(mockIO).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          query: { userId: 'user123' },
        }),
      );
    });
  });
});
