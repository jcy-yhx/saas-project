-- Full-text search: generated tsvector column weighted by field importance
-- title = weight 'A' (highest), description = weight 'B'
ALTER TABLE "Task" ADD COLUMN "searchVector" tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
  setweight(to_tsvector('english', coalesce("description", '')), 'B')
) STORED;

-- GIN index for fast full-text queries
CREATE INDEX "Task_searchVector_idx" ON "Task" USING GIN ("searchVector");
