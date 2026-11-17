-- AlterEnum
ALTER TYPE "MatchEventType" ADD VALUE 'ADD_TIME';

-- AlterTable
ALTER TABLE "match_events" ADD COLUMN     "period" TEXT;

-- AlterTable
ALTER TABLE "match_states" ADD COLUMN     "addedTimeSec" INTEGER NOT NULL DEFAULT 0;

