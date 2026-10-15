import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CreateDumpDto } from './dto/create-dump.dto.js';
import { UpdateDumpDto } from './dto/update-dump.dto.js';
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

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDumpDto) {
    return this.dumpsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.dumpsService.remove(id);
  }
}
