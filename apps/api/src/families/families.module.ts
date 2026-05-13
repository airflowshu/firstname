import { Module } from '@nestjs/common';
import { DemoResetModule } from '../demo-reset/demo-reset.module';
import { PrismaModule } from '../prisma/prisma.module';
import { FamiliesController } from './families.controller';
import { FamiliesService } from './families.service';

@Module({
  imports: [PrismaModule, DemoResetModule],
  controllers: [FamiliesController],
  providers: [FamiliesService],
})
export class FamiliesModule {}
