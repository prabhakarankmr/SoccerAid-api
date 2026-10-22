import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { MetaService } from './meta.service';

@ApiTags('meta')
@Controller('meta')
export class MetaController {
  constructor(private readonly metaService: MetaService) {}
}
