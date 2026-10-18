import { Controller, Get, Header, Res } from '@nestjs/common';
import type { Response } from 'express';
import { resolve } from 'node:path';
import { GetUsageHistory } from '../../usage/application/get-usage-history';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly getUsageHistory: GetUsageHistory) {}

  @Get()
  index(@Res() response: Response): void {
    response.sendFile(resolve(process.cwd(), 'dashboard/dist/index.html'));
  }

  @Get('api/requests')
  @Header('Cache-Control', 'no-store')
  history() {
    return this.getUsageHistory.execute();
  }
}
