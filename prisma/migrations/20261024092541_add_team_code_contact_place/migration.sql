-- AlterTable
ALTER TABLE "teams" ADD COLUMN     "code" TEXT NOT NULL,
ADD COLUMN     "contactNumber" TEXT,
ADD COLUMN     "place" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "teams_code_key" ON "teams"("code");
