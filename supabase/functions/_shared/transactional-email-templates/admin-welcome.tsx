import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr, Button,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Spa Bliss Bookings"

interface AdminWelcomeProps {
  email?: string
  loginUrl?: string
}

const AdminWelcomeEmail = ({ email, loginUrl }: AdminWelcomeProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your admin account for {SITE_NAME} has been created</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Heading style={h1}>🌿 Welcome, Admin!</Heading>
        </Section>
        <Text style={greeting}>Hello,</Text>
        <Text style={text}>
          An admin account has been created for you at <strong>{SITE_NAME}</strong>.
        </Text>
        <Section style={detailsBox}>
          <Text style={detailRow}>📧 <strong>Email:</strong> {email || 'N/A'}</Text>
        </Section>
        <Text style={text}>
          You can now sign in to the admin dashboard to manage bookings, services, and settings.
        </Text>
        {loginUrl && (
          <Section style={{ textAlign: 'center' as const, margin: '24px 0' }}>
            <Button style={button} href={loginUrl}>
              Sign In to Dashboard
            </Button>
          </Section>
        )}
        <Text style={text}>
          If you did not expect this email, please ignore it or contact the team.
        </Text>
        <Hr style={hr} />
        <Text style={footer}>Best regards, {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: AdminWelcomeEmail,
  subject: 'Your admin account has been created',
  displayName: 'Admin welcome',
  previewData: {
    email: 'newadmin@spa.com',
    loginUrl: 'https://example.com/admin/login',
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
const button = { backgroundColor: 'hsl(30, 35%, 28%)', color: '#ffffff', padding: '12px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold' as const, textDecoration: 'none' }
const hr = { borderColor: 'hsl(35, 20%, 85%)', margin: '20px 0' }
const footer = { fontSize: '12px', color: 'hsl(25, 15%, 45%)', margin: '0' }
