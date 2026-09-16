import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateReferenceListValueDto } from './dto/create-reference-list-value.dto';
import { ReferenceListsService } from './reference-lists.service';

/**
 * Read is open to any authenticated role (Staff needs these to populate
 * dropdowns; Admin/Management browsing them causes no harm) — only
 * writes are Admin-only, per the web dashboard's "Manage Lists" screen.
 */
@Controller('reference-lists')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReferenceListsController {
  constructor(private readonly referenceListsService: ReferenceListsService) {}

  @Get()
  findAll() {
    return this.referenceListsService.findAll();
  }

  @Get(':category')
  findByCategory(@Param('category') category: string) {
    return this.referenceListsService.findByCategory(category);
  }

  @Post(':category')
  @Roles('admin')
  create(@Param('category') category: string, @Body() dto: CreateReferenceListValueDto) {
    return this.referenceListsService.create(category, dto.value);
  }

  @Delete(':category/:id')
  @Roles('admin')
  async remove(@Param('category') category: string, @Param('id') id: string) {
    await this.referenceListsService.remove(category, id);
    return { success: true };
  }
}
