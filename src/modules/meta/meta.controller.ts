import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/decorators/public.decorator';

import { GetFormationsDto } from './dto/get-formations.dto';
import { FormatEntity } from './entities/format.entity';
import { FormationEntity } from './entities/formation.entity';
import { MetaService } from './meta.service';

// Static reference data (supported player counts and their formation/pitch-coordinate
// templates) — no auth needed to read it, same as any other lookup table.
@Public()
@ApiTags('meta')
@Controller('meta')
export class MetaController {
  constructor(private readonly metaService: MetaService) {}

  @Get('formats')
  getFormats(): FormatEntity[] {
    return this.metaService.getFormats();
  }

  @Get('formations')
  getFormations(@Query() query: GetFormationsDto): FormationEntity[] {
    return this.metaService.getFormations(query.playersPerSide);
  }
}
