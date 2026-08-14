import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { type PublicUser } from '../users/user.types';
import { CreateReceptionDto } from './dto/create-reception.dto';
import { InstructionsDto } from './dto/instructions.dto';
import { ReceptionsService } from './receptions.service';

@Controller('receptions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReceptionsController {
  constructor(private readonly receptionsService: ReceptionsService) {}

  @Post()
  create(@Body() dto: CreateReceptionDto, @CurrentUser() user: PublicUser) {
    return this.receptionsService.create(user.id, dto);
  }

  @Get()
  findAll() {
    return this.receptionsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.receptionsService.findOne(id);
  }

  @Post(':id/instructions')
  @Roles('admin')
  addInstructions(@Param('id') id: string, @Body() dto: InstructionsDto) {
    return this.receptionsService.addInstructions(id, dto.instructions);
  }

  @Post(':id/complete')
  complete(@Param('id') id: string) {
    return this.receptionsService.complete(id);
  }
}
