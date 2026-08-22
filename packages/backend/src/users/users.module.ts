import { Module } from '@nestjs/common';

import { UsersController } from './users.controller';
import { UsersService } from './users.service';

// Deliberately does NOT import AuthModule (unlike other feature modules)
// — AuthModule already imports *this* module, and NestJS's Passport
// 'jwt' strategy registration is a global side effect of JwtStrategy
// being instantiated once via AppModule -> AuthModule, not something
// each consuming module needs to re-import. Importing AuthModule here
// too would just create a circular reference for no benefit.
@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
