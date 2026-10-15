import { Controller, Get } from '@nestjs/common';
import { ScriptsService } from './scripts.service.js';

@Controller('scripts')
export class ScriptsController {
  constructor(private readonly scriptsService: ScriptsService) {}

  @Get()
  list() {
    return this.scriptsService.list();
  }
}
