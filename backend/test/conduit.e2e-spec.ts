import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * End-to-end journey against a real Postgres (uses DATABASE_URL).
 *
 * Every fixture is namespaced with a per-run suffix and torn down afterwards, so
 * the suite is safe to run repeatedly against the seeded development database
 * without disturbing jake or the seeded article.
 */
const RUN = Date.now().toString(36);
const alice = { username: `alice_${RUN}`, email: `alice_${RUN}@example.com`, password: 'Passw0rd!' };
const mallory = {
  username: `mallory_${RUN}`,
  email: `mallory_${RUN}@example.com`,
  password: 'Passw0rd!',
};

describe('Conduit API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: () => request.Agent;

  let aliceToken = '';
  let malloryToken = '';
  let slug = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
    http = () => request(app.getHttpServer());
  });

  afterAll(async () => {
    await prisma.article.deleteMany({ where: { author: { username: { contains: RUN } } } });
    await prisma.user.deleteMany({ where: { username: { contains: RUN } } });
    await prisma.tag.deleteMany({ where: { name: `tag${RUN}`, articles: { none: {} } } });
    await app.close();
  });

  describe('health', () => {
    it('liveness returns exactly {status:ok}', async () => {
      const res = await http().get('/api/health').expect(200);
      expect(res.body).toEqual({ status: 'ok' });
    });

    it('readiness round-trips a query', async () => {
      await http().get('/api/health/deep').expect(200);
    });
  });

  describe('registration and login', () => {
    it('registers alice and returns a usable token', async () => {
      const res = await http().post('/api/users').send({ user: alice }).expect(201);
      expect(res.body.user.token).toEqual(expect.any(String));
      expect(res.body.user).not.toHaveProperty('passwordHash');
      aliceToken = res.body.user.token;

      await http().get('/api/user').set('Authorization', `Token ${aliceToken}`).expect(200);
    });

    it('ignores a role claim in the payload (no privilege escalation)', async () => {
      const res = await http()
        .post('/api/users')
        .send({ user: { ...mallory, role: 'ADMIN' } })
        .expect(201);
      expect(res.body.user.role).toBe('USER');
      malloryToken = res.body.user.token;
    });

    it('rejects a duplicate username with 409', async () => {
      await http()
        .post('/api/users')
        .send({ user: { ...alice, email: `dup_${RUN}@example.com` } })
        .expect(409);
    });

    it('accepts the TLD-less seeded address and logs jake in', async () => {
      // Regression guard for @IsEmail({ require_tld: false }).
      const res = await http()
        .post('/api/users/login')
        .send({ user: { email: 'jake@demo', password: 'Demo1234!' } })
        .expect(200);
      expect(res.body.user.username).toBe('jake');
    });

    it('returns 401 with an indistinguishable message for bad password vs unknown user', async () => {
      const wrongPassword = await http()
        .post('/api/users/login')
        .send({ user: { email: alice.email, password: 'nope' } })
        .expect(401);
      const unknownUser = await http()
        .post('/api/users/login')
        .send({ user: { email: `ghost_${RUN}@example.com`, password: 'nope' } })
        .expect(401);
      expect(wrongPassword.body.message).toEqual(unknownUser.body.message);
    });

    it('accepts both Token and Bearer schemes', async () => {
      await http().get('/api/user').set('Authorization', `Token ${aliceToken}`).expect(200);
      await http().get('/api/user').set('Authorization', `Bearer ${aliceToken}`).expect(200);
      await http().get('/api/user').expect(401);
    });
  });

  describe('articles', () => {
    it('creates an article, slugifies the title and links tags', async () => {
      const res = await http()
        .post('/api/articles')
        .set('Authorization', `Token ${aliceToken}`)
        .send({
          article: {
            title: `Alice writes ${RUN}`,
            description: 'd',
            body: 'b',
            tagList: [`tag${RUN}`, 'dragons'],
          },
        })
        .expect(201);

      slug = res.body.article.slug;
      expect(slug).toContain('alice-writes');
      expect(res.body.article.favoritesCount).toBe(0);
      expect(res.body.article.tagList.sort()).toEqual([`tag${RUN}`, 'dragons'].sort());
    });

    it('rejects an unauthenticated create with 401', async () => {
      await http()
        .post('/api/articles')
        .send({ article: { title: 't', description: 'd', body: 'b' } })
        .expect(401);
    });

    it('surfaces the article in the global feed and under its tag', async () => {
      const global = await http().get('/api/articles').expect(200);
      expect(global.body).toHaveProperty('articlesCount');

      const byTag = await http().get(`/api/articles?tag=tag${RUN}`).expect(200);
      expect(byTag.body.articles.map((a: { slug: string }) => a.slug)).toContain(slug);
    });

    it('lists the new tag in /api/tags as a plain name', async () => {
      const res = await http().get('/api/tags').expect(200);
      expect(res.body.tags).toContain(`tag${RUN}`);
      expect(res.body.tags.every((t: unknown) => typeof t === 'string')).toBe(true);
    });

    it('caps limit and rejects a negative offset rather than 500ing', async () => {
      await http().get('/api/articles?limit=100000').expect(400);
      await http().get('/api/articles?offset=-1').expect(400);
    });

    it('returns 403 (not 401) when a different author edits or deletes', async () => {
      await http()
        .put(`/api/articles/${slug}`)
        .set('Authorization', `Token ${malloryToken}`)
        .send({ article: { body: 'hijacked' } })
        .expect(403);

      await http()
        .delete(`/api/articles/${slug}`)
        .set('Authorization', `Token ${malloryToken}`)
        .expect(403);

      // ...and the article is untouched.
      const res = await http().get(`/api/articles/${slug}`).expect(200);
      expect(res.body.article.body).toBe('b');
    });

    it('returns 401 (not 403) when the token is absent', async () => {
      await http().put(`/api/articles/${slug}`).send({ article: { body: 'x' } }).expect(401);
      await http().delete(`/api/articles/${slug}`).expect(401);
    });

    it('keeps the slug on a body-only edit', async () => {
      const res = await http()
        .put(`/api/articles/${slug}`)
        .set('Authorization', `Token ${aliceToken}`)
        .send({ article: { body: 'edited body' } })
        .expect(200);
      expect(res.body.article.slug).toBe(slug);
    });

    it('generates distinct slugs for identical titles', async () => {
      const title = `Duplicate ${RUN}`;
      const make = () =>
        http()
          .post('/api/articles')
          .set('Authorization', `Token ${aliceToken}`)
          .send({ article: { title, description: 'd', body: 'b' } })
          .expect(201);

      const [first, second] = [await make(), await make()];
      expect(first.body.article.slug).not.toBe(second.body.article.slug);
    });
  });

  describe('comments', () => {
    let commentId = '';

    it('rejects an unauthenticated comment with 401', async () => {
      await http()
        .post(`/api/articles/${slug}/comments`)
        .send({ comment: { body: 'hi' } })
        .expect(401);
    });

    it('creates a comment authored by the caller', async () => {
      const res = await http()
        .post(`/api/articles/${slug}/comments`)
        .set('Authorization', `Token ${aliceToken}`)
        .send({ comment: { body: 'Nice post' } })
        .expect(201);

      commentId = res.body.comment.id;
      expect(res.body.comment.author.username).toBe(alice.username);
      expect(res.body.comment.createdAt).toEqual(expect.any(String));
    });

    it('returns 403 when a different user deletes the comment', async () => {
      await http()
        .delete(`/api/articles/${slug}/comments/${commentId}`)
        .set('Authorization', `Token ${malloryToken}`)
        .expect(403);
    });

    it('returns 404 for a real comment id addressed via the wrong article', async () => {
      await http()
        .delete(`/api/articles/how-to-train-your-dragon/comments/${commentId}`)
        .set('Authorization', `Token ${aliceToken}`)
        .expect(404);
    });

    it('lets the author delete their own comment', async () => {
      await http()
        .delete(`/api/articles/${slug}/comments/${commentId}`)
        .set('Authorization', `Token ${aliceToken}`)
        .expect(200);
    });
  });

  describe('favorites and follows', () => {
    it('favoriting is idempotent and the count is recomputed', async () => {
      const first = await http()
        .post(`/api/articles/${slug}/favorite`)
        .set('Authorization', `Token ${malloryToken}`)
        .expect(200);
      expect(first.body.article).toMatchObject({ favorited: true, favoritesCount: 1 });

      const again = await http()
        .post(`/api/articles/${slug}/favorite`)
        .set('Authorization', `Token ${malloryToken}`)
        .expect(200);
      expect(again.body.article.favoritesCount).toBe(1);
    });

    it('unfavoriting twice never drives the count negative', async () => {
      await http()
        .delete(`/api/articles/${slug}/favorite`)
        .set('Authorization', `Token ${malloryToken}`)
        .expect(200);
      const res = await http()
        .delete(`/api/articles/${slug}/favorite`)
        .set('Authorization', `Token ${malloryToken}`)
        .expect(200);
      expect(res.body.article.favoritesCount).toBe(0);
    });

    it('rejects an unauthenticated follow with 401 and a self-follow with 400', async () => {
      await http().post(`/api/profiles/${alice.username}/follow`).expect(401);
      await http()
        .post(`/api/profiles/${alice.username}/follow`)
        .set('Authorization', `Token ${aliceToken}`)
        .expect(400);
    });

    it('following puts the author\'s articles in the follower\'s feed', async () => {
      const emptyFeed = await http()
        .get('/api/articles/feed')
        .set('Authorization', `Token ${malloryToken}`)
        .expect(200);
      expect(emptyFeed.body.articlesCount).toBe(0);

      await http()
        .post(`/api/profiles/${alice.username}/follow`)
        .set('Authorization', `Token ${malloryToken}`)
        .expect(200);

      const feed = await http()
        .get('/api/articles/feed')
        .set('Authorization', `Token ${malloryToken}`)
        .expect(200);
      expect(feed.body.articlesCount).toBeGreaterThan(0);
      expect(
        feed.body.articles.every(
          (a: { author: { username: string } }) => a.author.username === alice.username,
        ),
      ).toBe(true);
    });

    it('reflects the viewer in the following flag and unfollows idempotently', async () => {
      const viewed = await http()
        .get(`/api/profiles/${alice.username}`)
        .set('Authorization', `Token ${malloryToken}`)
        .expect(200);
      expect(viewed.body.profile.following).toBe(true);

      const anon = await http().get(`/api/profiles/${alice.username}`).expect(200);
      expect(anon.body.profile.following).toBe(false);

      await http()
        .delete(`/api/profiles/${alice.username}/follow`)
        .set('Authorization', `Token ${malloryToken}`)
        .expect(200);
      await http()
        .delete(`/api/profiles/${alice.username}/follow`)
        .set('Authorization', `Token ${malloryToken}`)
        .expect(200);
    });
  });

  describe('admin settings', () => {
    it('requires authentication and the ADMIN role', async () => {
      await http().get('/api/admin/settings').expect(401);
      await http()
        .get('/api/admin/settings')
        .set('Authorization', `Token ${aliceToken}`)
        .expect(403);
    });
  });

  describe('deletion', () => {
    it('deletes the author\'s own article and cascades', async () => {
      await http()
        .delete(`/api/articles/${slug}`)
        .set('Authorization', `Token ${aliceToken}`)
        .expect(200);
      await http().get(`/api/articles/${slug}`).expect(404);
    });
  });
});
