-- Community posts can attach short videos. Videos go straight from the browser
-- to Storage through a signed upload URL, so the bucket limit is the hard cap.
-- Images stay capped at 6MB by app/api/community/upload.

update storage.buckets
set
  file_size_limit = 52428800,
  allowed_mime_types = array[
    'image/png', 'image/jpeg', 'image/webp', 'image/gif',
    'video/mp4', 'video/webm', 'video/quicktime'
  ]
where id = 'community-media';
