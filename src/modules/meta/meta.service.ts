import { Injectable } from '@nestjs/common';

import { FormatEntity } from './entities/format.entity';
import { FormationEntity } from './entities/formation.entity';
import { getFormationsFor, SUPPORTED_PLAYERS_PER_SIDE } from './formations.data';

@Injectable()
export class MetaService {
  getFormats(): FormatEntity[] {
    return SUPPORTED_PLAYERS_PER_SIDE.map((playersPerSide) => ({
      playersPerSide,
      label: `${String(playersPerSide)}v${String(playersPerSide)}`,
    }));
  }

  getFormations(playersPerSide: number): FormationEntity[] {
    return getFormationsFor(playersPerSide);
  }
}
