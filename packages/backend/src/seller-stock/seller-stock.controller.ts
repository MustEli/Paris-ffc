import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { type PublicUser } from '../users/user.types';
import { CreatePalletDto } from './dto/create-pallet.dto';
import { SellerStockService } from './seller-stock.service';

/**
 * NOTE: put-away assignment used to live here directly (instructions +
 * put-away endpoints) but has moved to packages/backend/src/put-away —
 * a proper per-staff task-assignment layer (Feature 4). This controller
 * now only covers intake (Feature 3); SellerStockService's
 * giveInstructions/putAway/updateLocation methods are still here and
 * still used, just called by PutAwayService instead of exposed directly.
 */
@Controller('seller-stock')
@UseGuards(JwtAuthGuard, RolesGuard)
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
}
