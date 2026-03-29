// __tests__/integration/news.integration.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { getRequest } from '../test-utils';
import { News } from '../../models/news.js';

// ==================== Helpers ====================

const seedArticle = (overrides = {}) =>
  News.create({
    source: { id: null, name: 'TechCrunch' },
    author: 'Jane Doe',
    title: 'Test Article Title',
    description: 'Test article description',
    url: `https://example.com/article-${Date.now()}-${Math.random()}`,
    urlToImage: 'https://example.com/image.jpg',
    publishedAt: new Date(),
    content: 'Test article content',
    ...overrides,
  });

describe('News Integration Tests', () => {
  // ==================== GET /news ====================

  describe('GET /members/news (Get News)', () => {
    it('should return all news articles', async () => {
      await seedArticle({ title: 'Article One' });
      await seedArticle({ title: 'Article Two' });

      const res = await getRequest().get('/members/news');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2);
    });

    it('should return empty array when no articles exist', async () => {
      const res = await getRequest().get('/members/news');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(0);
    });

    it('should return correctly shaped article objects', async () => {
      await seedArticle();

      const res = await getRequest().get('/members/news');

      expect(res.status).toBe(200);
      const article = res.body[0];
      expect(article).toHaveProperty('_id');
      expect(article).toHaveProperty('title');
      expect(article).toHaveProperty('url');
      expect(article).toHaveProperty('publishedAt');
      expect(article).toHaveProperty('source');
      expect(article.source).toHaveProperty('name');
    });

    it('should return articles with optional fields as null when not provided', async () => {
      await seedArticle({
        author: null,
        description: null,
        urlToImage: null,
        content: null,
        source: { id: null, name: 'Reuters' },
      });

      const res = await getRequest().get('/members/news');

      expect(res.status).toBe(200);
      const article = res.body[0];
      expect(article.author).toBeNull();
      expect(article.description).toBeNull();
      expect(article.urlToImage).toBeNull();
      expect(article.content).toBeNull();
      expect(article.source.id).toBeNull();
    });

    it('should return all articles up to the seeded amount', async () => {
      const articles = Array.from({ length: 10 }, (_, i) =>
        seedArticle({ title: `Article ${i}`, publishedAt: new Date() }),
      );
      await Promise.all(articles);

      const res = await getRequest().get('/members/news');

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(10);
    });

    // The route has no checkToken middleware — unauthenticated requests are allowed
    it('should return 200 without authentication', async () => {
      const res = await getRequest().get('/members/news');
      expect(res.status).toBe(200);
    });
  });
});
