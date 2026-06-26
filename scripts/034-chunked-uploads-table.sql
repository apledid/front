-- Create table for tracking chunked uploads
CREATE TABLE IF NOT EXISTS chunked_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  content_type TEXT,
  file_size BIGINT NOT NULL,
  upload_type TEXT NOT NULL,
  total_chunks INTEGER NOT NULL,
  uploaded_chunks INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_chunked_uploads_upload_id ON chunked_uploads(upload_id);
CREATE INDEX IF NOT EXISTS idx_chunked_uploads_user_id ON chunked_uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_chunked_uploads_expires_at ON chunked_uploads(expires_at);
