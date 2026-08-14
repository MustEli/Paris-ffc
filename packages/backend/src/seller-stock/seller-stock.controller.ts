import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { type PublicUser } from '../users/user.types';
import { CreatePalletDto } from './dto/create-pallet.dto';
import { PutAwayInstructionsDto } from './dto/put-away-instructions.dto';
import { SellerStockService } from './seller-stock.service';

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

  @Post(':id/instructions')
  @Roles('admin')
  giveInstructions(@Param('id') id: string, @Body() dto: PutAwayInstructionsDto) {
    return this.sellerStockService.giveInstructions(id, dto.location);
  }

  @Post(':id/put-away')
  putAway(@Param('id') id: string) {
    return this.sellerStockService.putAway(id);
  }
}
