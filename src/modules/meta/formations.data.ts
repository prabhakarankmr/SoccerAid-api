import { FormationEntity, FormationSlotEntity } from './entities/formation.entity';

// Outfield line sizes, defense→attack, per playersPerSide (GK is implicit, not counted here —
// each array's sum + 1 must equal the playersPerSide key it's listed under). Several curated
// shapes per size rather than one "correct" formation; coordinates are generated, not
// hand-typed, so a new entry here can't desync slot count from playersPerSide.
const FORMATION_LINES: Record<number, number[][]> = {
  3: [[1, 1]],
  4: [
    [2, 1],
    [1, 2],
  ],
  5: [
    [2, 2],
    [1, 2, 1],
  ],
  6: [
    [2, 3],
    [3, 2],
  ],
  7: [
    [3, 2, 1],
    [2, 3, 1],
  ],
  8: [
    [3, 3, 1],
    [2, 3, 2],
  ],
  9: [
    [3, 3, 2],
    [3, 4, 1],
  ],
  10: [
    [4, 4, 1],
    [3, 4, 2],
  ],
  11: [
    [4, 4, 2],
    [4, 3, 3],
    [3, 5, 2],
  ],
};

export const SUPPORTED_PLAYERS_PER_SIDE = Object.keys(FORMATION_LINES)
  .map(Number)
  .sort((a, b) => a - b);

function buildFormation(playersPerSide: number, lines: number[]): FormationEntity {
  const slots: FormationSlotEntity[] = [{ slotIndex: 0, isGoalkeeper: true, posX: 50, posY: 95 }];
  const lineCount = lines.length;

  lines.forEach((lineSize, lineIndex) => {
    const posY = lineCount === 1 ? 50 : 80 - lineIndex * (65 / (lineCount - 1));

    for (let i = 0; i < lineSize; i += 1) {
      const posX = lineSize === 1 ? 50 : 15 + i * (70 / (lineSize - 1));
      slots.push({
        slotIndex: slots.length,
        isGoalkeeper: false,
        posX: Math.round(posX),
        posY: Math.round(posY),
      });
    }
  });

  return { name: lines.join('-'), playersPerSide, slots };
}

export function getFormationsFor(playersPerSide: number): FormationEntity[] {
  const lines = FORMATION_LINES[playersPerSide];
  return lines ? lines.map((line) => buildFormation(playersPerSide, line)) : [];
}
