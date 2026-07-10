type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
};

const SMTP_TIMEOUT_MS = 20_000;

export function getSmtpConfig(): SmtpConfig | null {
  const host = Deno.env.get('ZOHO_SMTP_HOST');
  const port = Number(Deno.env.get('ZOHO_SMTP_PORT') ?? '465');
  const user = Deno.env.get('ZOHO_SMTP_USER');
  const password = Deno.env.get('ZOHO_SMTP_PASS') ?? Deno.env.get('ZOHO_SMTP_PASSWORD');
  const from = Deno.env.get('ZOHO_FROM_EMAIL') ?? user;

  if (!host || !user || !password || !from) return null;
  return { host, port, user, password, from };
}

function encodeBase64(value: string): string {
  return btoa(value);
}

async function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out`)), SMTP_TIMEOUT_MS);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

class SmtpConnection {
  #conn: Deno.Conn | Deno.TlsConn;
  #decoder = new TextDecoder();
  #encoder = new TextEncoder();
  #buffer = '';

  constructor(conn: Deno.Conn | Deno.TlsConn) {
    this.#conn = conn;
  }

  async close() {
    try {
      this.#conn.close();
    } catch {
      // ignore close errors
    }
  }

  async readLine(): Promise<string> {
    while (!this.#buffer.includes('\r\n')) {
      const chunk = new Uint8Array(4096);
      const bytesRead = await this.#conn.read(chunk);
      if (bytesRead === null) {
        throw new Error('SMTP connection closed unexpectedly');
      }
      this.#buffer += this.#decoder.decode(chunk.subarray(0, bytesRead));
    }

    const lineEnd = this.#buffer.indexOf('\r\n');
    const line = this.#buffer.slice(0, lineEnd);
    this.#buffer = this.#buffer.slice(lineEnd + 2);
    return line;
  }

  async readResponse(): Promise<string> {
    const lines: string[] = [];
    while (true) {
      const line = await this.readLine();
      lines.push(line);
      if (line.length >= 4 && line[3] === ' ') break;
    }
    return lines.join('\n');
  }

  async writeLine(command: string): Promise<string> {
    await this.#conn.write(this.#encoder.encode(`${command}\r\n`));
    return this.readResponse();
  }

  expectCode(response: string, code: string) {
    if (!response.startsWith(code)) {
      throw new Error(response.trim() || `Expected SMTP code ${code}`);
    }
  }
}

async function connectSmtp(config: SmtpConfig): Promise<SmtpConnection> {
  if (config.port === 465) {
    const conn = await Deno.connectTls({ hostname: config.host, port: config.port });
    return new SmtpConnection(conn);
  }

  const conn = await Deno.connect({ hostname: config.host, port: config.port });
  const smtp = new SmtpConnection(conn);
  const greeting = await smtp.readResponse();
  smtp.expectCode(greeting, '220');

  const ehlo = await smtp.writeLine(`EHLO ${config.host}`);
  smtp.expectCode(ehlo, '250');

  const startTls = await smtp.writeLine('STARTTLS');
  smtp.expectCode(startTls, '220');

  const tlsConn = await Deno.startTls(conn, { hostname: config.host });
  return new SmtpConnection(tlsConn);
}

async function authenticate(smtp: SmtpConnection, user: string, password: string) {
  const auth = await smtp.writeLine('AUTH LOGIN');
  smtp.expectCode(auth, '334');

  const userResp = await smtp.writeLine(encodeBase64(user));
  smtp.expectCode(userResp, '334');

  const passResp = await smtp.writeLine(encodeBase64(password));
  smtp.expectCode(passResp, '235');
}

export async function sendZohoEmail(to: string, subject: string, body: string): Promise<void> {
  const config = getSmtpConfig();
  if (!config) {
    throw new Error('SMTP not configured');
  }

  await withTimeout(sendZohoEmailInner(config, to, subject, body), 'SMTP send');
}

async function sendZohoEmailInner(
  config: SmtpConfig,
  to: string,
  subject: string,
  body: string,
): Promise<void> {
  const smtp = await connectSmtp(config);

  try {
    if (config.port === 465) {
      const greeting = await smtp.readResponse();
      smtp.expectCode(greeting, '220');
    }

    const ehlo = await smtp.writeLine(`EHLO ${config.host}`);
    smtp.expectCode(ehlo, '250');

    await authenticate(smtp, config.user, config.password);

    const mailFrom = await smtp.writeLine(`MAIL FROM:<${config.from}>`);
    smtp.expectCode(mailFrom, '250');

    const rcptTo = await smtp.writeLine(`RCPT TO:<${to}>`);
    smtp.expectCode(rcptTo, '250');

    const data = await smtp.writeLine('DATA');
    smtp.expectCode(data, '354');

    const message = [
      `From: ${config.from}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      '',
      body,
    ].join('\r\n');

    const sent = await smtp.writeLine(`${message}\r\n.`);
    smtp.expectCode(sent, '250');

    const quit = await smtp.writeLine('QUIT');
    smtp.expectCode(quit, '221');
  } finally {
    await smtp.close();
  }
}
