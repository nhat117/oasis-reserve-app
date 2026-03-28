import { Link } from 'react-router-dom';
import { useI18n } from '@/hooks/useI18n';
import { ArrowLeft } from 'lucide-react';

const SoftwareTerms = () => {
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <Link to="/admin" className="inline-flex items-center gap-1.5 text-xs tracking-[0.1em] uppercase text-muted-foreground hover:text-foreground transition-colors mb-10">
          <ArrowLeft className="h-3.5 w-3.5" /> {t('Quay lại')}
        </Link>

        <div className="mb-10">
          <h1 className="text-2xl sm:text-3xl font-light mb-2">Software Terms and Conditions</h1>
          <p className="text-sm text-muted-foreground">Last updated: March 2026</p>
        </div>

        <div className="text-sm text-muted-foreground space-y-6 leading-relaxed">
          <section>
            <h2 className="text-base font-medium text-foreground mb-2">1. Introduction</h2>
            <p>
              These terms and conditions apply to the use of the booking and management software
              provided by Olive Marketing. By using this software, you agree to follow and be
              bound by these terms. If you do not agree with any part of these terms, please stop
              using the software immediately.
            </p>
          </section>

          <section>
            <h2 className="text-base font-medium text-foreground mb-2">2. License to Use</h2>
            <p>
              Olive Marketing gives you a limited, non-exclusive, and non-transferable license to
              use this software for your business operations. You may not copy, modify, distribute,
              sell, or lease any part of the software without written permission from Olive Marketing.
              This license is valid only for the business that originally purchased or subscribed to
              the software.
            </p>
          </section>

          <section>
            <h2 className="text-base font-medium text-foreground mb-2">3. Intellectual Property</h2>
            <p>
              All source code, designs, user interfaces, and related materials belong to Olive Marketing.
              You do not gain any ownership rights by using this software. All trademarks, logos, and
              brand features used in the software are the property of Olive Marketing.
            </p>
          </section>

          <section>
            <h2 className="text-base font-medium text-foreground mb-2">4. Data and Privacy</h2>
            <p>
              The software collects and stores customer information such as names, phone numbers,
              and email addresses for the purpose of booking management. All data is stored securely
              on cloud servers with encryption. You are responsible for protecting access to your
              admin account and for following local data protection laws. Olive Marketing will not
              sell or share your customer data with any third party.
            </p>
          </section>

          <section>
            <h2 className="text-base font-medium text-foreground mb-2">5. Service Availability</h2>
            <p>
              Olive Marketing will make reasonable efforts to keep the software running at all times.
              However, there may be times when the software is unavailable due to maintenance, updates,
              or technical issues. Olive Marketing will try to give notice before any planned downtime.
              We do not guarantee that the software will be available without interruption at all times.
            </p>
          </section>

          <section>
            <h2 className="text-base font-medium text-foreground mb-2">6. Limitation of Liability</h2>
            <p>
              The software is provided on an "as is" basis. Olive Marketing is not responsible for
              any direct or indirect damages that may come from using the software. This includes,
              but is not limited to, loss of data, business interruption, or loss of revenue. You
              agree to use the software at your own risk.
            </p>
          </section>

          <section>
            <h2 className="text-base font-medium text-foreground mb-2">7. Updates and Changes</h2>
            <p>
              Olive Marketing may update, change, or remove features of the software at any time.
              We will try to give reasonable notice before making major changes. Continued use of
              the software after any changes means that you accept the updated terms. We may also
              update these terms from time to time, and the latest version will always be available
              on this page.
            </p>
          </section>

          <section>
            <h2 className="text-base font-medium text-foreground mb-2">8. Support and Maintenance</h2>
            <p>
              Technical support and software updates are provided based on a separate service agreement.
              Olive Marketing will respond to support requests within a reasonable time. Support is
              available during normal business hours unless stated otherwise in your service agreement.
            </p>
          </section>

          <section>
            <h2 className="text-base font-medium text-foreground mb-2">9. Termination</h2>
            <p>
              Olive Marketing may end your license to use the software if you break any of these terms.
              If your license is ended, you must stop using the software and delete all copies. Any
              data stored in the system will be available for download for 30 days after termination.
              After that period, your data may be permanently deleted.
            </p>
          </section>

          <section>
            <h2 className="text-base font-medium text-foreground mb-2">10. Governing Law</h2>
            <p>
              These terms are governed by the laws of the State of Victoria, Australia. Any disputes
              will be resolved in the courts of Victoria. If any part of these terms is found to be
              invalid, the remaining parts will still apply.
            </p>
          </section>
        </div>

        <div className="text-center pt-10 mt-10 border-t border-border/40 space-y-1">
          <p className="text-xs text-muted-foreground/50">
            Crafted with <span className="text-red-400">&#9829;</span> in Melbourne
          </p>
          <p className="text-xs text-muted-foreground/40">
            &copy; {new Date().getFullYear()} Olive Marketing. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SoftwareTerms;
