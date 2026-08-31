import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigResolverModule } from './lib/config.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { ProfilesModule } from './profiles/profiles.module';
import { ArticlesModule } from './articles/articles.module';
import { CommentsModule } from './comments/comments.module';
import { TagsModule } from './tags/tags.module';
import { AdminSettingsModule } from './admin/settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    ConfigResolverModule,
    HealthModule,
    AuthModule,
    ProfilesModule,
    ArticlesModule,
    CommentsModule,
    TagsModule,
    AdminSettingsModule,
  ],
})
export class AppModule {}
