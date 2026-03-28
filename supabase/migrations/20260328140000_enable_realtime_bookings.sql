-- Enable realtime for bookings table so admin gets notified of new bookings
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
