-- Add editable HTML content for About Us and Terms & Conditions pages
INSERT INTO public.app_settings (key, value, tenant_id)
VALUES
  ('about_content', '<h2>Đặt lịch và hủy lịch</h2>
<p>Quý khách có thể đặt lịch trực tuyến hoặc qua điện thoại. Vui lòng hủy lịch ít nhất 2 giờ trước giờ hẹn để tránh ảnh hưởng đến lịch phục vụ.</p>

<h2>Thanh toán</h2>
<p>Chúng tôi chấp nhận thanh toán bằng tiền mặt và thẻ. Phụ phí có thể áp dụng khi thanh toán bằng thẻ tín dụng.</p>

<h2>Chính sách hoàn tiền</h2>
<p>Nếu quý khách không hài lòng với dịch vụ, vui lòng thông báo ngay cho nhân viên. Chúng tôi sẽ cố gắng giải quyết trong khả năng tốt nhất.</p>

<h2>Bảo mật thông tin</h2>
<p>Thông tin cá nhân của quý khách được bảo mật và chỉ sử dụng cho mục đích đặt lịch và liên lạc. Chúng tôi không chia sẻ thông tin cho bên thứ ba.</p>', '28125b20-bc18-463e-b50d-f8a41b398b4b'),

  ('terms_content', '<h2>1. Introduction</h2>
<p>These terms and conditions apply to the use of the booking and management software provided by Olive Marketing. By using this software, you agree to follow and be bound by these terms.</p>

<h2>2. License to Use</h2>
<p>Olive Marketing gives you a limited, non-exclusive, and non-transferable license to use this software for your business operations. You may not copy, modify, distribute, sell, or lease any part of the software without written permission.</p>

<h2>3. Intellectual Property</h2>
<p>All source code, designs, user interfaces, and related materials belong to Olive Marketing. You do not gain any ownership rights by using this software.</p>

<h2>4. Data and Privacy</h2>
<p>The software collects and stores customer information such as names, phone numbers, and email addresses for the purpose of booking management. All data is stored securely on cloud servers with encryption.</p>

<h2>5. Service Availability</h2>
<p>Olive Marketing will make reasonable efforts to keep the software running at all times. However, there may be times when the software is unavailable due to maintenance, updates, or technical issues.</p>

<h2>6. Limitation of Liability</h2>
<p>The software is provided on an "as is" basis. Olive Marketing is not responsible for any direct or indirect damages that may come from using the software.</p>

<h2>7. Updates and Changes</h2>
<p>Olive Marketing may update, change, or remove features of the software at any time. Continued use of the software after any changes means that you accept the updated terms.</p>

<h2>8. Support and Maintenance</h2>
<p>Technical support and software updates are provided based on a separate service agreement.</p>

<h2>9. Termination</h2>
<p>Olive Marketing may end your license to use the software if you break any of these terms. Any data stored in the system will be available for download for 30 days after termination.</p>

<h2>10. Governing Law</h2>
<p>These terms are governed by the laws of the State of Victoria, Australia. Any disputes will be resolved in the courts of Victoria.</p>', '28125b20-bc18-463e-b50d-f8a41b398b4b')

ON CONFLICT (key) DO NOTHING;
