import { beforeEach, describe, expect, it, vi } from 'vitest';
import { create } from 'zustand';
import type { StoreState } from '../useStore';
import type { IPost } from '@/models/posts.model';
import { createPostsSlice } from './postsStore';
import { mockAxiosResponse } from '@/__mocks__/mocks';

vi.mock('@/utils', () => ({
  fetchAPI: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import { fetchAPI } from '@/utils';
import { toast } from 'sonner';

const mockFetchAPI = vi.mocked(fetchAPI);
const mockToastSuccess = vi.mocked(toast.success);

type TestPostsStore = {
  getState: () => StoreState;
  setState: (partial: Partial<StoreState>) => void;

  setShowAddPost: (value: boolean) => void;
  setShowSharePost: (value: boolean) => void;
  setSharePostId: (postId: string | null) => void;
  fetchPostById: (id: string) => Promise<void>;
  fetchMyPosts: () => Promise<void>;
  fetchMemberPosts: (username: string) => Promise<void>;
  fetchAllPosts: () => Promise<void>;
  fetchFriendsPosts: () => Promise<void>;
  deletePost: (id: string) => Promise<void>;
  uploadPost: (data: IPost | FormData) => Promise<boolean>;
  toggleLike: (postId: string) => Promise<void>;
  addComment: (postId: string, data: { text: string }) => Promise<void>;
  sharePost: (memberIds: string[], postId: string | null) => Promise<void>;
  clearCurrentPost: () => Promise<void>;
};

describe('Posts Slice', () => {
  let useStore: TestPostsStore;
  let storeInstance: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reliable localStorage mock
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) =>
      key === 'lh_token' ? 'fake-token' : null,
    );
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {});

    storeInstance = create<StoreState>((set, get, api) => ({
      ...(createPostsSlice(set, get, api) as any),

      // Required cross-slice mocks
      loggedInMember: { _id: 'currentUser123' } as any,
      messages: [],
    }));

    useStore = {
      getState: storeInstance.getState,
      setState: storeInstance.setState,

      setShowAddPost: storeInstance.getState().setShowAddPost,
      setShowSharePost: storeInstance.getState().setShowSharePost,
      setSharePostId: storeInstance.getState().setSharePostId,
      fetchPostById: storeInstance.getState().fetchPostById,
      fetchMyPosts: storeInstance.getState().fetchMyPosts,
      fetchMemberPosts: storeInstance.getState().fetchMemberPosts,
      fetchAllPosts: storeInstance.getState().fetchAllPosts,
      fetchFriendsPosts: storeInstance.getState().fetchFriendsPosts,
      deletePost: storeInstance.getState().deletePost,
      uploadPost: storeInstance.getState().uploadPost,
      toggleLike: storeInstance.getState().toggleLike,
      addComment: storeInstance.getState().addComment,
      sharePost: storeInstance.getState().sharePost,
      clearCurrentPost: storeInstance.getState().clearCurrentPost,
    };
  });

  it('should have correct initial state', () => {
    const state = useStore.getState();

    expect(state.currentPost).toBeNull();
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.allPosts).toEqual([]);
    expect(state.myPosts).toEqual([]);
    expect(state.friendsPosts).toEqual([]);
    expect(state.memberPosts).toEqual([]);
    expect(state.showAddPost).toBe(false);
    expect(state.showSharePost).toBe(false);
    expect(state.sharePostId).toBeNull();
  });

  describe('Simple setters', () => {
    it('should toggle showAddPost', () => {
      useStore.setShowAddPost(true);
      expect(useStore.getState().showAddPost).toBe(true);

      useStore.setShowAddPost(false);
      expect(useStore.getState().showAddPost).toBe(false);
    });

    it('should set share post id', () => {
      useStore.setSharePostId('post123');
      expect(useStore.getState().sharePostId).toBe('post123');

      useStore.setSharePostId(null);
      expect(useStore.getState().sharePostId).toBeNull();
    });
  });

  describe('fetchPostById', () => {
    it('should fetch and set current post', async () => {
      const mockPost: IPost = { _id: 'post123', content: 'Test post' } as IPost;
      mockFetchAPI.mockResolvedValueOnce(mockAxiosResponse(mockPost));

      await useStore.fetchPostById('post123');

      expect(useStore.getState().currentPost).toEqual(mockPost);
      expect(useStore.getState().loading).toBe(false);
    });
  });

  describe('fetchMyPosts', () => {
    it('should fetch and set my posts', async () => {
      const mockPosts: IPost[] = [{ _id: 'p1' }, { _id: 'p2' }] as IPost[];
      mockFetchAPI.mockResolvedValueOnce(mockAxiosResponse(mockPosts));

      await useStore.fetchMyPosts();

      expect(useStore.getState().myPosts).toEqual(mockPosts);
      expect(useStore.getState().loading).toBe(false);
    });
  });

  describe('uploadPost', () => {
    it('should upload post and add it to allPosts', async () => {
      const newPost: IPost = { _id: 'new123', content: 'New post' } as IPost;
      mockFetchAPI.mockResolvedValueOnce(mockAxiosResponse(newPost));

      const success = await useStore.uploadPost({ content: 'New post' } as any);

      expect(success).toBe(true);
      expect(useStore.getState().allPosts).toContainEqual(newPost);
    });
  });

  describe('toggleLike', () => {
    it('should optimistically toggle like and then update from backend', async () => {
      const initialPost: IPost = {
        _id: 'post123',
        likes: ['otherUser'],
      } as IPost;

      useStore.setState({ friendsPosts: [initialPost] } as any);

      mockFetchAPI.mockResolvedValueOnce(
        mockAxiosResponse({ likes: ['otherUser', 'currentUser123'] }),
      );

      await useStore.toggleLike('post123');

      const state = useStore.getState();
      const updatedPost = state.friendsPosts.find((p) => p._id === 'post123');

      expect(updatedPost?.likes).toContain('currentUser123');
    });
  });

  describe('deletePost', () => {
    it('should call delete API and show success toast', async () => {
      mockFetchAPI.mockResolvedValueOnce(mockAxiosResponse({}));

      await useStore.deletePost('post123');

      expect(mockFetchAPI).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'delete',
          url: 'posts/delete/post123',
        }),
      );
      expect(mockToastSuccess).toHaveBeenCalledWith('Post deleted!');
    });
  });

  describe('sharePost', () => {
    it('should send share request with correct payload', async () => {
      mockFetchAPI.mockResolvedValueOnce(mockAxiosResponse({}));

      await useStore.sharePost(['user1', 'user2'], 'post999');

      expect(mockFetchAPI).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'post',
          url: '/posts/share',
          data: {
            recipients: ['user1', 'user2'],
            text: expect.stringContaining('/posts/post999'),
          },
        }),
      );
    });
  });
});
