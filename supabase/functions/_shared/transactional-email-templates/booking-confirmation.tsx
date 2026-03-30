import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Oasis Reserve"

interface BookingConfirmationProps {
  customerName?: string
  serviceName?: string
  therapistName?: string
  bookingDate?: string
  startTime?: string
  endTime?: string
}

const BookingConfirmationEmail = ({
  customerName, serviceName, therapistName, bookingDate, startTime, endTime,
}: BookingConfirmationProps) => (
  <Html lang="vi" dir="ltr">
    <Head />
    <Preview>Xác nhận đặt lịch tại {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Heading style={h1}>💅 Xác Nhận Đặt Lịch</Heading>
        </Section>
        <Text style={greeting}>
          Xin chào {customerName || 'Quý khách'},
        </Text>
        <Text style={text}>
          Lịch hẹn của bạn đã được xác nhận tại <strong>{SITE_NAME}</strong>. Dưới đây là thông tin chi tiết:
        </Text>
        <Section style={detailsBox}>
          <Text style={detailRow}>📋 <strong>Dịch vụ:</strong> {serviceName || 'N/A'}</Text>
          <Text style={detailRow}>👤 <strong>Thợ:</strong> {therapistName || 'N/A'}</Text>
          <Text style={detailRow}>📅 <strong>Ngày:</strong> {bookingDate || 'N/A'}</Text>
          <Text style={detailRow}>🕐 <strong>Giờ:</strong> {startTime || 'N/A'} – {endTime || 'N/A'}</Text>
        </Section>
        <Text style={text}>
          Vui lòng đến đúng giờ. Nếu cần thay đổi hoặc hủy lịch, hãy liên hệ với chúng tôi trước ít nhất 2 giờ.
        </Text>
        <Hr style={hr} />
        <Text style={footer}>Trân trọng, {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: BookingConfirmationEmail,
  subject: 'Xác nhận đặt lịch tại Oasis Reserve',
  displayName: 'Xác nhận đặt lịch',
  previewData: {
    customerName: 'Nguyễn Văn A',
    serviceName: 'Sơn gel cao cấp',
    therapistName: 'Chị Lan',
    bookingDate: '28/03/2026',
    startTime: '10:00',
    endTime: '11:00',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Be Vietnam Pro', Arial, sans-serif" }
const container = { padding: '20px 25px', maxWidth: '520px', margin: '0 auto' }
const headerSection = { backgroundColor: 'hsl(30, 35%, 28%)', borderRadius: '12px 12px 0 0', padding: '24px', textAlign: 'center' as const }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#ffffff', margin: '0' }
const greeting = { fontSize: '16px', color: 'hsl(25, 30%, 12%)', margin: '20px 0 8px' }
const text = { fontSize: '14px', color: 'hsl(25, 15%, 45%)', lineHeight: '1.6', margin: '0 0 16px' }
const detailsBox = { backgroundColor: 'hsl(35, 30%, 95%)', borderRadius: '8px', padding: '16px', margin: '0 0 20px' }
const detailRow = { fontSize: '14px', color: 'hsl(25, 30%, 12%)', margin: '4px 0', lineHeight: '1.6' }
const hr = { borderColor: 'hsl(35, 20%, 85%)', margin: '20px 0' }
const footer = { fontSize: '12px', color: 'hsl(25, 15%, 45%)', margin: '0' }
