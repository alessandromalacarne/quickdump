import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CreateDumpDto } from './dto/create-dump.dto.js';
import { DumpsService } from './dumps.service.js';

@Controller('dumps')
export class DumpsController {
  constructor(private readonly dumpsService: DumpsService) {}

  @Post()
  create(@Body() dto: CreateDumpDto) {
    return this.dumpsService.create(dto);
  }

  @Get()
  list(@Query('tag') tag?: string) {
    return this.dumpsService.list(tag);
  }
}
