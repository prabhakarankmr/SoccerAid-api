export interface FormationSlotEntity {
  slotIndex: number;
  isGoalkeeper: boolean;
  // 0-100 pitch percentages. posX: left→right. posY: 100 = this team's own goal line
  // (defensive-most), 0 = the opponent's goal line (attacking-most) — Team B's coordinates are
  // mirrored by the server when rendered, not stored separately (BACKEND_INSTRUCTIONS.md §7.2).
  posX: number;
  posY: number;
}

export interface FormationEntity {
  name: string;
  playersPerSide: number;
  slots: FormationSlotEntity[];
}
