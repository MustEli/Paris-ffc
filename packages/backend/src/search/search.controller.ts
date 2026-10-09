import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SearchService } from './search.service';

/** Web dashboard's global header search — Admin/Management only, matching who the dashboard itself is for. */
@Controller('search')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'management')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  search(@Query('q') q: string | undefined) {
    return this.searchService.search(q ?? '');
  }
}
