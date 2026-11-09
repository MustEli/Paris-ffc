import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { BulkUpsertWarehouseLocationsDto } from './dto/bulk-upsert-warehouse-locations.dto';
import { CreateWarehouseLocationDto } from './dto/create-warehouse-location.dto';
import { UpdateWarehouseLocationDto } from './dto/update-warehouse-location.dto';
import { WarehouseLocationsService } from './warehouse-locations.service';

/**
 * Read is open to any authenticated role (Staff needs these to populate
 * "Put-away location" dropdowns) — only writes are Admin-only, per the
 * web dashboard's "Put-Away & Location Assignment" screen.
 */
@Controller('warehouse-locations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WarehouseLocationsController {
  constructor(private readonly warehouseLocationsService: WarehouseLocationsService) {}

  @Get()
  findAll() {
    return this.warehouseLocationsService.findAll();
  }

  @Post()
  @Roles('admin')
  create(@Body() dto: CreateWarehouseLocationDto) {
    return this.warehouseLocationsService.create(dto.location, dto.description);
  }

  @Post('bulk')
  @Roles('admin')
  bulkUpsert(@Body() dto: BulkUpsertWarehouseLocationsDto) {
    return this.warehouseLocationsService.bulkUpsert(dto.rows);
  }

  @Patch(':id')
  @Roles('admin')
  update(@Param('id') id: string, @Body() dto: UpdateWarehouseLocationDto) {
    return this.warehouseLocationsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  async remove(@Param('id') id: string) {
    await this.warehouseLocationsService.remove(id);
    return { success: true };
  }
}
