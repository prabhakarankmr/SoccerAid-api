import { FormationEntity } from './entities/formation.entity';

// Curated formations database with anti-collision coordinates tuned visually via Formation Editor.
const CURATED_FORMATIONS: Record<number, FormationEntity[]> = {
  3: [
    {
      name: '1-1',
      playersPerSide: 3,
      slots: [
        { slotIndex: 0, isGoalkeeper: true, posX: 50, posY: 92 },
        { slotIndex: 1, isGoalkeeper: false, posX: 50, posY: 52 },
        { slotIndex: 2, isGoalkeeper: false, posX: 52, posY: 18 },
      ],
    },
    {
      name: '2-0',
      playersPerSide: 3,
      slots: [
        { slotIndex: 0, isGoalkeeper: true, posX: 50, posY: 94 },
        { slotIndex: 1, isGoalkeeper: false, posX: 30, posY: 54 },
        { slotIndex: 2, isGoalkeeper: false, posX: 70, posY: 54 },
      ],
    },
  ],
  4: [
    {
      name: '2-1',
      playersPerSide: 4,
      slots: [
        { slotIndex: 0, isGoalkeeper: true, posX: 50, posY: 94 },
        { slotIndex: 1, isGoalkeeper: false, posX: 32, posY: 64 },
        { slotIndex: 2, isGoalkeeper: false, posX: 68, posY: 64 },
        { slotIndex: 3, isGoalkeeper: false, posX: 50, posY: 26 },
      ],
    },
    {
      name: '1-2',
      playersPerSide: 4,
      slots: [
        { slotIndex: 0, isGoalkeeper: true, posX: 50, posY: 94 },
        { slotIndex: 1, isGoalkeeper: false, posX: 50, posY: 66 },
        { slotIndex: 2, isGoalkeeper: false, posX: 32, posY: 28 },
        { slotIndex: 3, isGoalkeeper: false, posX: 68, posY: 28 },
      ],
    },
  ],
  5: [
    {
      name: '1-2-1',
      playersPerSide: 5,
      slots: [
        { slotIndex: 0, isGoalkeeper: true, posX: 50, posY: 94 },
        { slotIndex: 1, isGoalkeeper: false, posX: 50, posY: 70 },
        { slotIndex: 2, isGoalkeeper: false, posX: 24, posY: 46 },
        { slotIndex: 3, isGoalkeeper: false, posX: 76, posY: 46 },
        { slotIndex: 4, isGoalkeeper: false, posX: 50, posY: 24 },
      ],
    },
    {
      name: '2-2',
      playersPerSide: 5,
      slots: [
        { slotIndex: 0, isGoalkeeper: true, posX: 50, posY: 94 },
        { slotIndex: 1, isGoalkeeper: false, posX: 30, posY: 68 },
        { slotIndex: 2, isGoalkeeper: false, posX: 70, posY: 68 },
        { slotIndex: 3, isGoalkeeper: false, posX: 32, posY: 26 },
        { slotIndex: 4, isGoalkeeper: false, posX: 68, posY: 26 },
      ],
    },
  ],
  6: [
    {
      name: '2-2-1',
      playersPerSide: 6,
      slots: [
        { slotIndex: 0, isGoalkeeper: true, posX: 50, posY: 94 },
        { slotIndex: 1, isGoalkeeper: false, posX: 30, posY: 72 },
        { slotIndex: 2, isGoalkeeper: false, posX: 70, posY: 72 },
        { slotIndex: 3, isGoalkeeper: false, posX: 32, posY: 48 },
        { slotIndex: 4, isGoalkeeper: false, posX: 68, posY: 48 },
        { slotIndex: 5, isGoalkeeper: false, posX: 50, posY: 24 },
      ],
    },
  ],
  7: [
    {
      name: '2-3-1',
      playersPerSide: 7,
      slots: [
        { slotIndex: 0, isGoalkeeper: true, posX: 50, posY: 94 },
        { slotIndex: 1, isGoalkeeper: false, posX: 30, posY: 72 },
        { slotIndex: 2, isGoalkeeper: false, posX: 70, posY: 72 },
        { slotIndex: 3, isGoalkeeper: false, posX: 20, posY: 46 },
        { slotIndex: 4, isGoalkeeper: false, posX: 50, posY: 46 },
        { slotIndex: 5, isGoalkeeper: false, posX: 80, posY: 46 },
        { slotIndex: 6, isGoalkeeper: false, posX: 50, posY: 22 },
      ],
    },
    {
      name: '3-2-1',
      playersPerSide: 7,
      slots: [
        { slotIndex: 0, isGoalkeeper: true, posX: 50, posY: 94 },
        { slotIndex: 1, isGoalkeeper: false, posX: 22, posY: 74 },
        { slotIndex: 2, isGoalkeeper: false, posX: 50, posY: 76 },
        { slotIndex: 3, isGoalkeeper: false, posX: 78, posY: 74 },
        { slotIndex: 4, isGoalkeeper: false, posX: 36, posY: 45 },
        { slotIndex: 5, isGoalkeeper: false, posX: 64, posY: 45 },
        { slotIndex: 6, isGoalkeeper: false, posX: 50, posY: 22 },
      ],
    },
  ],
  8: [
    {
      name: '3-3-1',
      playersPerSide: 8,
      slots: [
        { slotIndex: 0, isGoalkeeper: true, posX: 50, posY: 94 },
        { slotIndex: 1, isGoalkeeper: false, posX: 22, posY: 75 },
        { slotIndex: 2, isGoalkeeper: false, posX: 50, posY: 77 },
        { slotIndex: 3, isGoalkeeper: false, posX: 78, posY: 75 },
        { slotIndex: 4, isGoalkeeper: false, posX: 22, posY: 48 },
        { slotIndex: 5, isGoalkeeper: false, posX: 50, posY: 48 },
        { slotIndex: 6, isGoalkeeper: false, posX: 78, posY: 48 },
        { slotIndex: 7, isGoalkeeper: false, posX: 50, posY: 22 },
      ],
    },
  ],
  9: [
    {
      name: '3-3-2',
      playersPerSide: 9,
      slots: [
        { slotIndex: 0, isGoalkeeper: true, posX: 50, posY: 94 },
        { slotIndex: 1, isGoalkeeper: false, posX: 22, posY: 75 },
        { slotIndex: 2, isGoalkeeper: false, posX: 50, posY: 78 },
        { slotIndex: 3, isGoalkeeper: false, posX: 78, posY: 75 },
        { slotIndex: 4, isGoalkeeper: false, posX: 22, posY: 48 },
        { slotIndex: 5, isGoalkeeper: false, posX: 50, posY: 48 },
        { slotIndex: 6, isGoalkeeper: false, posX: 78, posY: 48 },
        { slotIndex: 7, isGoalkeeper: false, posX: 36, posY: 24 },
        { slotIndex: 8, isGoalkeeper: false, posX: 64, posY: 24 },
      ],
    },
  ],
  10: [
    {
      name: '3-4-2',
      playersPerSide: 10,
      slots: [
        { slotIndex: 0, isGoalkeeper: true, posX: 50, posY: 94 },
        { slotIndex: 1, isGoalkeeper: false, posX: 22, posY: 75 },
        { slotIndex: 2, isGoalkeeper: false, posX: 50, posY: 78 },
        { slotIndex: 3, isGoalkeeper: false, posX: 78, posY: 75 },
        { slotIndex: 4, isGoalkeeper: false, posX: 18, posY: 48 },
        { slotIndex: 5, isGoalkeeper: false, posX: 40, posY: 50 },
        { slotIndex: 6, isGoalkeeper: false, posX: 60, posY: 50 },
        { slotIndex: 7, isGoalkeeper: false, posX: 82, posY: 48 },
        { slotIndex: 8, isGoalkeeper: false, posX: 36, posY: 22 },
        { slotIndex: 9, isGoalkeeper: false, posX: 64, posY: 22 },
      ],
    },
  ],
  11: [
    {
      name: '4-4-2',
      playersPerSide: 11,
      slots: [
        { slotIndex: 0, isGoalkeeper: true, posX: 50, posY: 94 },
        { slotIndex: 1, isGoalkeeper: false, posX: 16, posY: 75 },
        { slotIndex: 2, isGoalkeeper: false, posX: 38, posY: 78 },
        { slotIndex: 3, isGoalkeeper: false, posX: 62, posY: 78 },
        { slotIndex: 4, isGoalkeeper: false, posX: 84, posY: 75 },
        { slotIndex: 5, isGoalkeeper: false, posX: 16, posY: 48 },
        { slotIndex: 6, isGoalkeeper: false, posX: 38, posY: 50 },
        { slotIndex: 7, isGoalkeeper: false, posX: 62, posY: 50 },
        { slotIndex: 8, isGoalkeeper: false, posX: 84, posY: 48 },
        { slotIndex: 9, isGoalkeeper: false, posX: 38, posY: 24 },
        { slotIndex: 10, isGoalkeeper: false, posX: 62, posY: 24 },
      ],
    },
    {
      name: '4-3-3',
      playersPerSide: 11,
      slots: [
        { slotIndex: 0, isGoalkeeper: true, posX: 50, posY: 94 },
        { slotIndex: 1, isGoalkeeper: false, posX: 16, posY: 75 },
        { slotIndex: 2, isGoalkeeper: false, posX: 38, posY: 78 },
        { slotIndex: 3, isGoalkeeper: false, posX: 62, posY: 78 },
        { slotIndex: 4, isGoalkeeper: false, posX: 84, posY: 75 },
        { slotIndex: 5, isGoalkeeper: false, posX: 28, posY: 50 },
        { slotIndex: 6, isGoalkeeper: false, posX: 50, posY: 58 },
        { slotIndex: 7, isGoalkeeper: false, posX: 72, posY: 50 },
        { slotIndex: 8, isGoalkeeper: false, posX: 18, posY: 22 },
        { slotIndex: 9, isGoalkeeper: false, posX: 50, posY: 20 },
        { slotIndex: 10, isGoalkeeper: false, posX: 82, posY: 22 },
      ],
    },
  ],
};

export const SUPPORTED_PLAYERS_PER_SIDE = [3, 4, 5, 6, 7, 8, 9, 10, 11];

export function getFormationsFor(playersPerSide: number): FormationEntity[] {
  return CURATED_FORMATIONS[playersPerSide] ?? [];
}
