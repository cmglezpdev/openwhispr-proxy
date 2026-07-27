import { Injectable } from '@nestjs/common';
import { join } from 'node:path';

const DEFAULT_PORT = 8080;
const DEFAULT_USAGE_DB_PATH = join(process.cwd(), 'data', 'usage.db');

@Injectable()
export class EnvService {
  readonly port: number;
  readonly usageDbPath: string;

  constructor() {
    this.port = parsePort(process.env.PORT);
    this.usageDbPath = process.env.USAGE_DB_PATH || DEFAULT_USAGE_DB_PATH;
  }
}

function parsePort(value: string | undefined): number {
  const parsed = Number(value);
  return value && Number.isInteger(parsed) && parsed > 0
    ? parsed
    : DEFAULT_PORT;
}
