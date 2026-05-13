import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DemoResetService } from './demo-reset.service';

@Module({
  imports: [PrismaModule],
  providers: [DemoResetService],
  exports: [DemoResetService],
})
export class DemoResetModule {}
