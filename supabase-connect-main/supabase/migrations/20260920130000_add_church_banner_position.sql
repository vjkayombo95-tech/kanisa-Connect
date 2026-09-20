-- Wave 21B: allow each church to control the vertical position of its dashboard cover photo.
-- 38 preserves the existing Wave 21A presentation for current churches.

ALTER TABLE public.churches
ADD COLUMN banner_position_y integer NOT NULL DEFAULT 38;

ALTER TABLE public.churches
ADD CONSTRAINT churches_banner_position_y_range
CHECK (banner_position_y BETWEEN 0 AND 100);
