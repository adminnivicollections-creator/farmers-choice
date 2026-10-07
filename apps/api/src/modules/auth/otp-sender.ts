import { Injectable, Logger } from '@nestjs/common';
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
