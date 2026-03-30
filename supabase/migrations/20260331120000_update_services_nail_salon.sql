-- Replace massage/spa services with nail salon services
-- First deactivate all existing services, then insert nail salon ones

UPDATE public.services SET is_active = false;

INSERT INTO public.services (name, description, duration_minutes, price, is_active)
VALUES
  ('Classic Manicure', 'Shape, buff, cuticle care, and polish application for a clean, polished look', 30, 35.00, true),
  ('Gel Manicure', 'Long-lasting gel polish with chip-free shine for up to two weeks', 45, 55.00, true),
  ('Classic Pedicure', 'Relaxing foot soak, exfoliation, cuticle care, and polish', 45, 45.00, true),
  ('Deluxe Pedicure', 'Classic pedicure plus hot stone massage, paraffin wax, and mask treatment', 60, 75.00, true),
  ('Acrylic Full Set', 'Full set of sculpted acrylic nail extensions with your choice of shape', 75, 85.00, true),
  ('Acrylic Infill', 'Maintenance fill for existing acrylic nails to keep them looking fresh', 45, 55.00, true),
  ('SNS Dipping Powder', 'Lightweight, durable dipping powder nails with a natural finish', 50, 65.00, true),
  ('Nail Art', 'Custom hand-painted designs, gems, foils, and creative nail art', 30, 25.00, true),
  ('Mani-Pedi Combo', 'Classic manicure and pedicure bundle for a complete nail refresh', 60, 70.00, true),
  ('Gel Removal', 'Safe gel or acrylic removal with nail conditioning treatment', 20, 15.00, true);
