-- Create storage bucket for church assets
INSERT INTO storage.buckets (id, name, public) VALUES ('church-assets', 'church-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to church-assets bucket
CREATE POLICY "Authenticated users can upload church assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'church-assets');

-- Allow anyone to view church assets (public bucket)
CREATE POLICY "Anyone can view church assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'church-assets');

-- Allow authenticated users to update their uploads
CREATE POLICY "Authenticated users can update church assets"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'church-assets');

-- Allow authenticated users to delete their uploads
CREATE POLICY "Authenticated users can delete church assets"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'church-assets');