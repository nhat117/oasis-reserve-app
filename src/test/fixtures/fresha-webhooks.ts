/**
 * Test fixtures for Fresha webhook payloads
 */

export const appointmentCreated = {
  event: "appointment.created",
  location_id: "loc_123",
  data: {
    id: "apt_001",
    date: "2026-04-05",
    start_time: "10:00",
    end_time: "11:00",
    status: "confirmed",
    client: {
      id: "cli_001",
      first_name: "Alice",
      last_name: "Johnson",
      phone: "+61400111222",
      email: "alice@example.com",
    },
    service: {
      id: "svc_001",
      name: "Gel Manicure",
      duration: 60,
      price: 55.0,
    },
    staff: {
      id: "staff_001",
      name: "Lisa",
      first_name: "Lisa",
    },
  },
};

export const appointmentUpdated = {
  event: "appointment.updated",
  location_id: "loc_123",
  data: {
    id: "apt_001",
    date: "2026-04-05",
    start_time: "14:00",
    end_time: "15:00",
    status: "confirmed",
    client: {
      id: "cli_001",
      first_name: "Alice",
      last_name: "Johnson",
      phone: "+61400111222",
      email: "alice@example.com",
    },
    service: {
      id: "svc_001",
      name: "Gel Manicure",
      duration: 60,
      price: 55.0,
    },
    staff: {
      id: "staff_001",
      name: "Lisa",
      first_name: "Lisa",
    },
  },
};

export const appointmentCancelled = {
  event: "appointment.cancelled",
  location_id: "loc_123",
  data: {
    id: "apt_001",
    status: "cancelled",
  },
};

export const clientCreated = {
  event: "client.created",
  location_id: "loc_123",
  data: {
    id: "cli_002",
    first_name: "Bob",
    last_name: "Smith",
    phone: "+61400222333",
    email: "bob@example.com",
  },
};
