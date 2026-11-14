import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ActiveShiftGuard } from '../shifts/active-shift.guard';
import { type PublicUser } from '../users/user.types';
import { CreatePalletDto } from './dto/create-pallet.dto';
import { DeletePalletsDto } from './dto/delete-pallets.dto';
import { SellerStockService } from './seller-stock.service';

/**
 * NOTE: put-away assignment used to live here directly (instructions +
 * put-away endpoints) but has moved to packages/backend/src/put-away —
 * a proper per-staff task-assignment layer (Feature 4). This controller
 * now only covers intake (Feature 3); SellerStockService's
 * giveInstructions/putAway/updateLocation methods are still here and
 * still used, just called by PutAwayService instead of exposed directly.
 */
/** ActiveShiftGuard only ever checks anything for Staff — Admin/Management browsing this same controller are unaffected. */
@Controller('seller-stock')
@UseGuards(JwtAuthGuard, RolesGuard, ActiveShiftGuard)
export class SellerStockController {
  constructor(private readonly sellerStockService: SellerStockService) {}

  @Post()
  create(@Body() dto: CreatePalletDto, @CurrentUser() user: PublicUser) {
    return this.sellerStockService.create(user.id, dto);
  }

  @Get()
  findAll() {
    return this.sellerStockService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.sellerStockService.findOne(id);
  }

  /** Largely legacy now — see SellerStockService.selfPutAway's doc comment. No body: locations are predefined/obvious, nothing left to confirm but the action itself. */
  @Post(':id/self-putaway')
  selfPutAway(@Param('id') id: string) {
    return this.sellerStockService.selfPutAway(id);
  }

  @Delete(':id')
  @Roles('admin', 'management')
  remove(@Param('id') id: string) {
    return this.sellerStockService.remove(id);
  }

  @Delete()
  @Roles('admin', 'management')
  removeMany(@Body() dto: DeletePalletsDto) {
    return this.sellerStockService.removeMany(dto.ids);
  }
}
