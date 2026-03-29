// __tests__/integration/posts.integration.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getRequest, createAuthenticatedUser } from '../test-utils';
import { Post } from '../../models/posts.js';

vi.mock('../../controllers/notifications.js', () => ({
  createNotification: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../common/socket.js', () => ({
  getRecieverSocketId: vi.fn().mockReturnValue(null),
}));

// ==================== Helper ====================

const createPost = async (token: string, overrides = {}) => {
  return getRequest()
    .post('/posts/post')
    .set('Authorization', `Bearer ${token}`)
    .send({ caption: 'Test caption', ...overrides });
};

describe('Posts Integration Tests', () => {
  let userA: any;
  let tokenA: string;
  let userB: any;
  let tokenB: string;

  beforeEach(async () => {
    const authA = await createAuthenticatedUser();
    const authB = await createAuthenticatedUser();
    userA = authA.user;
    tokenA = authA.token;
    userB = authB.user;
    tokenB = authB.token;
  });

  // ==================== POST /posts/post ====================

  describe('POST /posts/post (Create Post)', () => {
    it('should create a post successfully', async () => {
      const res = await createPost(tokenA);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('_id');
      expect(res.body.caption).toBe('Test caption');
      expect(res.body.author).toBeTruthy();
    });

    it('should persist post in database', async () => {
      const res = await createPost(tokenA);
      expect(res.status).toBe(201);

      const post = await Post.findById(res.body._id);
      expect(post).not.toBeNull();
      expect(post!.caption).toBe('Test caption');
    });

    it('should associate post with the authenticated author', async () => {
      const res = await createPost(tokenA);
      expect(res.status).toBe(201);

      const post = await Post.findById(res.body._id);
      expect(post!.author.toString()).toBe(userA._id.toString());
    });

    it('should return 422 if caption is missing', async () => {
      const res = await getRequest()
        .post('/posts/post')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({});

      expect(res.status).toBe(422);
    });

    it('should return 401 if not authenticated', async () => {
      const res = await getRequest().post('/posts/post').send({ caption: 'Test caption' });

      expect(res.status).toBe(401);
    });
  });

  // ==================== GET /posts ====================

  describe('GET /posts (Get All Posts)', () => {
    it('should return all posts', async () => {
      await createPost(tokenA);
      await createPost(tokenB);

      const res = await getRequest().get('/posts').set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
    });

    it('should populate author details', async () => {
      await createPost(tokenA);

      const res = await getRequest().get('/posts').set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      const post = res.body[0];
      expect(post.author).toHaveProperty('username');
      expect(post.author).toHaveProperty('firstName');
      expect(post.author).toHaveProperty('lastName');
    });

    // GET /posts has no checkToken in the router, so unauthenticated requests return 200
    it('should return 200 even if not authenticated', async () => {
      const res = await getRequest().get('/posts');
      expect(res.status).toBe(200);
    });
  });

  // ==================== GET /posts/:id ====================

  describe('GET /posts/:id (Get Post By Id)', () => {
    it('should return a post by id', async () => {
      const created = await createPost(tokenA);
      const postId = created.body._id;

      const res = await getRequest()
        .get(`/posts/${postId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body._id).toBe(postId);
      expect(res.body.caption).toBe('Test caption');
    });

    it('should populate author and comment authors', async () => {
      const created = await createPost(tokenA);
      const postId = created.body._id;

      await getRequest()
        .post(`/posts/${postId}/comments`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ text: 'Nice post!' });

      const res = await getRequest()
        .get(`/posts/${postId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.author).toHaveProperty('username');
      expect(res.body.comments[0].author).toHaveProperty('username');
    });

    it('should return 404 for non-existent post', async () => {
      const fakeId = '000000000000000000000001';

      const res = await getRequest()
        .get(`/posts/${fakeId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(404);
    });

    // GET /posts/:id has no checkToken in the router, so no 401 test applies
  });

  // ==================== GET /posts/myPosts ====================

  describe('GET /posts/myPosts (Get My Posts)', () => {
    it('should return only posts by the authenticated user', async () => {
      await createPost(tokenA);
      await createPost(tokenA);
      await createPost(tokenB);

      const res = await getRequest().get('/posts/myPosts').set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2);
      res.body.forEach((post: any) => {
        expect(post.author._id ?? post.author).toBe(userA._id.toString());
      });
    });

    it('should return empty array if user has no posts', async () => {
      const res = await getRequest().get('/posts/myPosts').set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });

    it('should return 401 if not authenticated', async () => {
      const res = await getRequest().get('/posts/myPosts');
      expect(res.status).toBe(401);
    });
  });

  // ==================== GET /posts/memberPosts/:username ====================

  describe('GET /posts/memberPosts/:username (Get Member Posts)', () => {
    it('should return posts for a given username', async () => {
      await createPost(tokenA);
      await createPost(tokenA);

      const res = await getRequest()
        .get(`/posts/memberPosts/${userA.username}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2);
    });

    it('should return empty array if member has no posts', async () => {
      const res = await getRequest()
        .get(`/posts/memberPosts/${userB.username}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });

    // GET /posts/memberPosts/:username has no checkToken, so no 401 test applies
  });

  // ==================== PUT /posts/:id/likes ====================

  describe('PUT /posts/:id/likes (Toggle Like)', () => {
    it('should like a post', async () => {
      const created = await createPost(tokenA);
      const postId = created.body._id;

      const res = await getRequest()
        .put(`/posts/${postId}/likes`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(200);
      expect(res.body.liked).toBe(true);
      expect(res.body.likeCount).toBe(1);
    });

    it('should unlike a post if already liked', async () => {
      const created = await createPost(tokenA);
      const postId = created.body._id;

      await getRequest().put(`/posts/${postId}/likes`).set('Authorization', `Bearer ${tokenB}`);

      const res = await getRequest()
        .put(`/posts/${postId}/likes`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(200);
      expect(res.body.liked).toBe(false);
      expect(res.body.likeCount).toBe(0);
    });

    it('should persist like in database', async () => {
      const created = await createPost(tokenA);
      const postId = created.body._id;

      await getRequest().put(`/posts/${postId}/likes`).set('Authorization', `Bearer ${tokenB}`);

      const post = await Post.findById(postId);
      expect(post!.likes.map((id: any) => id.toString())).toContain(userB._id.toString());
    });

    it('should return 404 for non-existent post', async () => {
      const fakeId = '000000000000000000000001';

      const res = await getRequest()
        .put(`/posts/${fakeId}/likes`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(404);
    });

    it('should return 401 if not authenticated', async () => {
      const created = await createPost(tokenA);

      const res = await getRequest().put(`/posts/${created.body._id}/likes`);
      expect(res.status).toBe(401);
    });
  });

  // ==================== POST /posts/:id/comments ====================

  describe('POST /posts/:id/comments (Add Comment)', () => {
    it('should add a comment successfully', async () => {
      const created = await createPost(tokenA);
      const postId = created.body._id;

      const res = await getRequest()
        .post(`/posts/${postId}/comments`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ text: 'Great post!' });

      expect(res.status).toBe(201);
      expect(res.body.comment.text).toBe('Great post!');
      expect(res.body.commentCount).toBe(1);
    });

    it('should persist comment in database', async () => {
      const created = await createPost(tokenA);
      const postId = created.body._id;

      await getRequest()
        .post(`/posts/${postId}/comments`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ text: 'Persisted comment' });

      const post = await Post.findById(postId);
      expect(post!.comments).toHaveLength(1);
      expect(post!.comments[0].text).toBe('Persisted comment');
    });

    it('should increment comment count with multiple comments', async () => {
      const created = await createPost(tokenA);
      const postId = created.body._id;

      await getRequest()
        .post(`/posts/${postId}/comments`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ text: 'First' });

      const res = await getRequest()
        .post(`/posts/${postId}/comments`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ text: 'Second' });

      expect(res.body.commentCount).toBe(2);
    });

    it('should return 422 if text is missing', async () => {
      const created = await createPost(tokenA);

      const res = await getRequest()
        .post(`/posts/${created.body._id}/comments`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({});

      expect(res.status).toBe(422);
    });

    it('should return 404 for non-existent post', async () => {
      const fakeId = '000000000000000000000001';

      const res = await getRequest()
        .post(`/posts/${fakeId}/comments`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ text: 'Hello' });

      expect(res.status).toBe(404);
    });

    it('should return 401 if not authenticated', async () => {
      const created = await createPost(tokenA);

      const res = await getRequest()
        .post(`/posts/${created.body._id}/comments`)
        .send({ text: 'Hello' });

      expect(res.status).toBe(401);
    });
  });

  // ==================== DELETE /posts/delete/:id ====================

  describe('DELETE /posts/delete/:id (Delete Post)', () => {
    it('should delete a post successfully', async () => {
      const created = await createPost(tokenA);
      const postId = created.body._id;

      const res = await getRequest()
        .delete(`/posts/delete/${postId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);

      const post = await Post.findById(postId);
      expect(post).toBeNull();
    });

    it('should return 404 for non-existent post', async () => {
      const fakeId = '000000000000000000000001';

      const res = await getRequest()
        .delete(`/posts/delete/${fakeId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(404);
    });

    it('should return 401 if not authenticated', async () => {
      const created = await createPost(tokenA);

      const res = await getRequest().delete(`/posts/delete/${created.body._id}`);
      expect(res.status).toBe(401);
    });
  });
});
