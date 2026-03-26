

## Spa Booking System — Gội Đầu Dưỡng Sinh

### Customer-Facing Pages

**1. Home / Landing Page**
- Spa name, description, and atmosphere photos
- Operating hours (9:00 AM – 6:00 PM)
- "Book Now" call-to-action button

**2. Service Catalog**
- List of available treatments (e.g., gội đầu dưỡng sinh, massage đầu, etc.)
- Each service shows: name, duration, price, short description

**3. Booking Page**
- Step-by-step booking flow:
  1. Select a service
  2. Pick a date
  3. Choose available time slot (30-min or 1-hour slots from 9AM–6PM)
  4. Select therapist (or "any available")
  5. Enter name & phone number
  6. Confirm booking
- Shows only available slots based on therapist schedules and existing bookings

**4. Booking Confirmation**
- Summary of booking details with a confirmation message

### Admin Dashboard (protected by login)

**5. Admin Login**
- Simple email/password authentication via Supabase Auth

**6. Bookings Management**
- Calendar/list view of all upcoming bookings
- Filter by date, therapist
- Cancel or reschedule bookings
- View customer contact info

**7. Therapist Management**
- Add/edit 2 therapists (name, working days)
- Set availability and days off

**8. Service Management**
- Add/edit/remove services with name, duration, price, and description

### Database (Supabase)
- **services** — treatment catalog
- **therapists** — staff profiles and availability
- **bookings** — customer reservations linked to service + therapist + time slot
- **user_roles** — admin role management
- Row-level security for admin-only operations

### Design
- Clean, calming aesthetic (soft greens/earth tones) fitting a wellness spa
- Mobile-friendly for customers booking on their phones
- Vietnamese language as primary UI language

