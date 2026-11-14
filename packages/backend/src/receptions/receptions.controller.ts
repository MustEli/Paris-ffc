import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ActiveShiftGuard } from '../shifts/active-shift.guard';
import { type PublicUser } from '../users/user.types';
import { AssignReceptionDto } from './dto/assign-reception.dto';
import { BulkInstructionsDto } from './dto/bulk-instructions.dto';
import { CreateReceptionDto } from './dto/create-reception.dto';
import { DeleteReceptionsDto } from './dto/delete-receptions.dto';
import { InstructionsDto } from './dto/instructions.dto';
import { ReceptionsService } from './receptions.service';

/** ActiveShiftGuard only ever checks anything for Staff — Admin/Management browsing this same controller are unaffected. */
@Controller('receptions')
@UseGuards(JwtAuthGuard, RolesGuard, ActiveShiftGuard)
export class ReceptionsController {
  constructor(private readonly receptionsService: ReceptionsService) {}

  @Post()
  create(@Body() dto: CreateReceptionDto, @CurrentUser() user: PublicUser) {
    return this.receptionsService.create(user, dto);
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

  /** Web dashboard's Excel bulk-instructions flow — see BulkInstructionsDto and the service method's doc comment. */
  @Post('bulk-instructions')
  @Roles('admin')
  bulkAddInstructions(@Body() dto: BulkInstructionsDto) {
    return this.receptionsService.bulkAddInstructions(dto.items);
  }

  @Post(':id/complete')
  complete(@Param('id') id: string) {
    return this.receptionsService.complete(id);
  }

  /** Task Board's third pending-item type — drag a reception still awaiting instructions onto an on-shift staff member. */
  @Post(':id/assign')
  @Roles('admin', 'management')
  assign(@Param('id') id: string, @Body() dto: AssignReceptionDto, @CurrentUser() user: PublicUser) {
    return this.receptionsService.assign(id, user.id, dto);
  }

  @Delete(':id')
  @Roles('admin', 'management')
  remove(@Param('id') id: string) {
    return this.receptionsService.remove(id);
  }

  @Delete()
  @Roles('admin', 'management')
  removeMany(@Body() dto: DeleteReceptionsDto) {
    return this.receptionsService.removeMany(dto.ids);
  }
}
