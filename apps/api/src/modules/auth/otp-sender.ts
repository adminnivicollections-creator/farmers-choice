import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Swap the delivery channel without touching auth logic. */
export abstract class OtpSender {
  abstract send(phone: string, code: string): Promise<void>;
}

/** Dev only. Prints the code to the API log so you can sign in without SMS. */
@Injectable()
export class ConsoleOtpSender extends OtpSender {
  private readonly log = new Logger('OTP');
  async send(phone: string, code: string) {
    this.log.warn(`DEV OTP for ${phone} is ${code} (console provider — not sent by SMS)`);
  }
}

/**
 * Production without a real SMS provider. The console sender would print every
 * code to the server log, where anyone with log access could sign in as anyone,
 * so sign-in is refused instead. The rest of the API keeps serving.
 */
export class DisabledOtpSender extends OtpSender {
  async send(): Promise<void> {
    throw new ServiceUnavailableException('Sign-in is not available yet.');
  }
}

export function otpSenderFor(config: ConfigService): OtpSender {
  if (config.get('OTP_PROVIDER') === 'msg91') return new Msg91OtpSender(config);
  if (config.get('NODE_ENV') === 'production') return new DisabledOtpSender();
  return new ConsoleOtpSender();
}

/**
 * MSG91. Blocked on DLT template registration with TRAI -- until the template
 * id exists this cannot deliver, so it fails loudly rather than silently.
 */
@Injectable()
export class Msg91OtpSender extends OtpSender {
  constructor(private config: ConfigService) { super(); }

  async send(phone: string, code: string) {
    const authKey = this.config.get<string>('MSG91_AUTH_KEY');
    const templateId = this.config.get<string>('MSG91_TEMPLATE_ID');
    if (!authKey || !templateId) {
      throw new Error('MSG91_AUTH_KEY / MSG91_TEMPLATE_ID missing — DLT registration incomplete');
    }
    const res = await fetch('https://control.msg91.com/api/v5/otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', authkey: authKey },
      body: JSON.stringify({ template_id: templateId, mobile: phone.replace('+', ''), otp: code }),
    });
    if (!res.ok) throw new Error(`MSG91 responded ${res.status}`);
  }
}
