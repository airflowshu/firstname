import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getSystemInfo() {
    return {
      name: '中国家族姓氏血亲管理系统 API',
      version: '0.1.0',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
