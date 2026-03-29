import { beforeEach, describe, expect, it, vi } from 'vitest';
import { create } from 'zustand';
import type { StoreState } from '../useStore';
import { createFriendsSlice } from './friendsStore';
import { fetchAPI } from '@/utils';
import { toast } from 'sonner';

// external dependencies mocking
vi.mock('@/utils/index', () => ({
  fetchAPI: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

// vi.mocked for type-safe mocking
const mockFetchAPI = vi.mocked(fetchAPI);
const mockToastError = vi.mocked(toast.error);

describe('Friends Slice', () => {
  let useStore: any;

  // daddy is gonna buy you a mockingbird

  beforeEach(() => {
    vi.clearAllMocks();

    // Set a default token so tests don't fail on "Not logged in" unless we want them to
    localStorage.setItem('lh_token', 'fake-token');

    useStore = create<StoreState>((set, get, store) => ({
      // Cast to any here because we are purposefully only testing one slice
      ...(createFriendsSlice(set, get, store) as any),

      // Mock the specific cross-slice dependencies
      updateLastMessages: vi.fn(),

      // Add a dummy state for other required properties if they cause crashes
      loggedInMember: null,
    })) as any;
  });

  describe('fetchFriends', () => {
    it('should fetch friends successfully and update last messages', async () => {
      const mockFriends = [
        {
          _id: 'friend1',
          lastMessage: { senderId: 'me', text: 'hi', createdAt: '2025-01-01' },
        },
        { _id: 'friend2' },
      ];

      mockFetchAPI.mockResolvedValueOnce({ data: mockFriends });

      await useStore.getState().fetchFriends();

      const state = useStore.getState();

      expect(mockFetchAPI).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'friends/all-friends',
          headers: expect.objectContaining({
            Authorization: expect.stringContaining('Bearer '),
          }),
        }),
      );

      expect(state.friends).toEqual(mockFriends);
      expect(state.friendsLoading).toBe(false);
      expect(state.friendsError).toBeNull();
      expect(state.updateLastMessages).toHaveBeenCalled();
    });

    // it('should set error when no token is present', async () => {
    //   vi.spyOn(localStorage, 'getItem').mockReturnValueOnce(null);

    //   await useStore.getState().fetchFriends();

    //   const state = useStore.getState();
    //   expect(state.friendsError).toBe('Not logged in!');
    //   expect(state.friendsLoading).toBe(false);
    // });

    it('should handle API error', async () => {
      mockFetchAPI.mockRejectedValueOnce({
        response: { data: { message: 'Network error' } },
      });

      await useStore.getState().fetchFriends();

      expect(mockToastError).toHaveBeenCalledWith('Network error');
      expect(useStore.getState().friendsError).toBe('Network error');
      expect(useStore.getState().friendsLoading).toBe(false);
    });
  });

  describe('addFriend', () => {
    it('should call API and refresh pending + relationship status', async () => {
      mockFetchAPI.mockResolvedValueOnce({});

      const fetchPendingSpy = vi.spyOn(useStore.getState(), 'fetchPending');
      const fetchStatusSpy = vi.spyOn(useStore.getState(), 'fetchRelationshipStatus');

      await useStore.getState().addFriend('user123');

      expect(mockFetchAPI).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'friends/add-friend/user123',
          method: 'post',
        }),
      );

      expect(fetchPendingSpy).toHaveBeenCalled();
      expect(fetchStatusSpy).toHaveBeenCalledWith('user123');
    });
  });

  describe('acceptFriendRequest', () => {
    it('should send correct PUT request with action accept', async () => {
      mockFetchAPI.mockResolvedValueOnce({});

      await useStore.getState().acceptFriendRequest('sender456');

      expect(mockFetchAPI).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'friends/sender456',
          method: 'put',
          data: { action: 'accept' },
        }),
      );
    });
  });

  describe('rejectFriendRequest', () => {
    it('should send correct PUT request with action decline', async () => {
      mockFetchAPI.mockResolvedValueOnce({});

      await useStore.getState().rejectFriendRequest('sender789');

      expect(mockFetchAPI).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'friends/sender789',
          method: 'put',
          data: { action: 'decline' },
        }),
      );
    });
  });

  // Add more tests for deleteFriend, fetchPending, fetchRelationshipStatus as needed
});
