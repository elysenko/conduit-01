'use strict';
/**
 * Conduit idempotent seed — plain JS so it runs with `node` in the slim runtime
 * image (no ts-node needed).
 *
 * Usage:  node prisma/seed/seed.js   |   npx prisma db seed
 *
 * Creates the demo author jake (jake@demo / Demo1234!) with the article
 * "How to train your dragon" tagged `dragons` + `training` and one comment.
 * Safe to re-run on every container boot — every write is an upsert.
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const DEMO_EMAIL = 'jake@demo';
const DEMO_PASSWORD = 'Demo1234!';
const ARTICLE_SLUG = 'how-to-train-your-dragon';
const TAGS = ['dragons', 'training'];

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // jake is ADMIN so the /admin/settings section is reachable out of the box.
  const jake = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {
      username: 'jake',
      bio: 'I work at statefarm',
      role: 'ADMIN',
      // Re-asserted on EVERY run, not just create. A create-only password freezes
      // the hash at first deploy while this script keeps printing a fresh
      // SEED_CRED line, so the recorded credential silently drifts from the
      // stored hash and demo login starts 401-ing.
      passwordHash,
    },
    create: {
      email: DEMO_EMAIL,
      username: 'jake',
      passwordHash,
      bio: 'I work at statefarm',
      image: null,
      role: 'ADMIN',
    },
  });

  const tags = [];
  for (const name of TAGS) {
    tags.push(
      await prisma.tag.upsert({
        where: { name },
        update: {},
        create: { name },
      }),
    );
  }

  const article = await prisma.article.upsert({
    where: { slug: ARTICLE_SLUG },
    update: {
      title: 'How to train your dragon',
      description: 'Ever wonder how?',
      body: 'It takes a Jacobian.\n\nYou have to believe.',
      authorId: jake.id,
    },
    create: {
      slug: ARTICLE_SLUG,
      title: 'How to train your dragon',
      description: 'Ever wonder how?',
      body: 'It takes a Jacobian.\n\nYou have to believe.',
      authorId: jake.id,
    },
  });

  for (const tag of tags) {
    await prisma.articleTag.upsert({
      where: { articleId_tagId: { articleId: article.id, tagId: tag.id } },
      update: {},
      create: { articleId: article.id, tagId: tag.id },
    });
  }

  // Deterministic comment id keeps the seed idempotent without a natural key.
  const commentId = 'seed-comment-how-to-train-your-dragon';
  await prisma.comment.upsert({
    where: { id: commentId },
    update: { body: 'Thank you so much!' },
    create: {
      id: commentId,
      body: 'Thank you so much!',
      articleId: article.id,
      authorId: jake.id,
    },
  });

  console.log(`SEED_CRED ADMIN ${DEMO_EMAIL} ${DEMO_PASSWORD}`);
  console.log(`Seeded article "${article.title}" (${article.slug})`);
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
