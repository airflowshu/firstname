import { Controller, Get, Param, Query } from '@nestjs/common';
import { GraphService } from './graph.service';

@Controller('graph')
export class GraphController {
  constructor(private readonly graphService: GraphService) {}

  @Get('member/:id')
  getMemberGraph(@Param('id') id: string, @Query('depth') depth?: string) {
    return this.graphService.getMemberGraph(id, Number.parseInt(depth ?? '2', 10));
  }
}
