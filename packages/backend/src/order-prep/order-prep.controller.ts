import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { type PublicUser } from '../users/user.types';
import { AssignOrderPrepTaskDto } from './dto/assign-order-prep-task.dto';
import { CreateSessionDto } from './dto/create-session.dto';
import { OrderPrepService } from './order-prep.service';

@Controller('order-prep')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrderPrepController {
  constructor(private readonly orderPrepService: OrderPrepService) {}

  @Post('sessions')
  @Roles('admin')
  createSession(@Body() dto: CreateSessionDto, @CurrentUser() user: PublicUser) {
    return this.orderPrepService.createSession(user.id, dto);
  }

  @Get('sessions')
  findAllSessions() {
    return this.orderPrepService.findAllSessions();
  }

  @Get('sessions/:id')
  findSession(@Param('id') id: string) {
    const session = this.orderPrepService.findSession(id);
    return { ...session, tasks: this.orderPrepService.tasksForSession(id) };
  }

  @Post('sessions/:id/tasks')
  @Roles('admin')
  assignTask(@Param('id') sessionId: string, @Body() dto: AssignOrderPrepTaskDto) {
    return this.orderPrepService.assignTask(sessionId, dto);
  }

  @Get('tasks')
  findAllTasks(@CurrentUser() user: PublicUser) {
    return this.orderPrepService.findAllTasksForUser(user);
  }

  @Get('tasks/:id')
  findTask(@Param('id') id: string, @CurrentUser() user: PublicUser) {
    return this.orderPrepService.findTaskForUser(id, user);
  }

  @Post('tasks/:id/start')
  start(@Param('id') id: string, @CurrentUser() user: PublicUser) {
    return this.orderPrepService.start(id, user);
  }

  @Post('tasks/:id/complete')
  complete(@Param('id') id: string, @CurrentUser() user: PublicUser) {
    return this.orderPrepService.complete(id, user);
  }
}
