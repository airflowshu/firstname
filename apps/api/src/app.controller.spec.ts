import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return system status info', () => {
      expect(appController.getSystemInfo()).toMatchObject({
        name: '中国家族姓氏血亲管理系统 API',
        status: 'ok',
      });
    });
  });
});
