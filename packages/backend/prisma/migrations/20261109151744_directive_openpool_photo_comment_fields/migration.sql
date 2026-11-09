-- AlterTable: Directive
-- "photoUrl" becomes "completionPhotoUrl" (same meaning — the photo
-- staff attaches when resolving) now that a creation-time photo also
-- exists, to keep the two unambiguous.
ALTER TABLE "Directive" RENAME COLUMN "photoUrl" TO "completionPhotoUrl";
ALTER TABLE "Directive" ADD COLUMN "creationPhotoUrl" TEXT;
ALTER TABLE "Directive" ADD COLUMN "creationComment" TEXT;
ALTER TABLE "Directive" ADD COLUMN "completionComment" TEXT;

-- AlterTable: OpenPoolTask
ALTER TABLE "OpenPoolTask" ADD COLUMN "creationPhotoUrl" TEXT;
ALTER TABLE "OpenPoolTask" ADD COLUMN "creationComment" TEXT;
ALTER TABLE "OpenPoolTask" ADD COLUMN "completionPhotoUrl" TEXT;
ALTER TABLE "OpenPoolTask" ADD COLUMN "completionComment" TEXT;
