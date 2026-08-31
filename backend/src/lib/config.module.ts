import { Global, Module } from '@nestjs/common';
import { ConfigResolverService } from './config';

@Global()
@Module({
  providers: [ConfigResolverService],
  exports: [ConfigResolverService],
})
export class ConfigResolverModule {}
