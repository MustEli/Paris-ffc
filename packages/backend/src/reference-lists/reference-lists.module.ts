import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ReferenceListsController } from './reference-lists.controller';
import { ReferenceListsService } from './reference-lists.service';

@Module({
  imports: [AuthModule], // needed for JwtStrategy to be registered
  controllers: [ReferenceListsController],
  providers: [ReferenceListsService],
})
export class ReferenceListsModule {}
