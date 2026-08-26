import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, type sheets_v4 } from 'googleapis';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
}

/**
 * `Date.prototype.toLocaleString()` with no arguments uses whatever
 * locale the server process happens to be running under — fine
 * consistently on this dev machine, but the hosted deploy (Render, a
 * Linux container) won't necessarily default to the same locale. Pin
 * it explicitly so every row written to the Sheet looks the same
 * regardless of which environment produced it.
 */
export function formatTimestampForSheet(date: Date): string {
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Thin wrapper around the Google Sheets API — appends rows to named
 * tabs, creating the tab (with a header row) the first time it's
 * written to. Used by ShiftsService/ReceptionsService (mirroring the
 * requirements doc's own "documented in a Google Sheet" / "all
 * recorded in a Google sheet" lines for Attendance and Reception) and
 * by ReportsController's manual dashboard-snapshot export.
 *
 * Deliberately optional: if no credentials/spreadsheet ID are
 * configured, every method is a silent no-op rather than throwing —
 * exporting to a spreadsheet should never be able to break the actual
 * feature (a shift ending, a reception completing) that triggered it.
 * This also means local dev/e2e tests need zero Google setup by
 * default, same pattern as Cloudinary uploads.
 */
@Injectable()
export class SheetsService implements OnModuleInit {
  private readonly logger = new Logger(SheetsService.name);
  private sheets: sheets_v4.Sheets | null = null;
  private spreadsheetId: string | null = null;
  private readonly knownTabs = new Set<string>();

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const spreadsheetId = this.config.get<string>('GOOGLE_SHEETS_SPREADSHEET_ID');
    if (!spreadsheetId) {
      this.logger.warn('GOOGLE_SHEETS_SPREADSHEET_ID not set — Google Sheets export disabled.');
      return;
    }

    const credentials = this.loadCredentials();
    if (!credentials) {
      this.logger.warn('Google service account credentials not found — Google Sheets export disabled.');
      return;
    }

    const auth = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    this.sheets = google.sheets({ version: 'v4', auth });
    this.spreadsheetId = spreadsheetId;
    this.logger.log('Google Sheets export enabled.');
  }

  private loadCredentials(): ServiceAccountCredentials | null {
    // Local dev: the key file the user saves directly (gitignored, see
    // .gitignore's "*-service-account.json" rule) — never deployed.
    const keyFilePath = join(process.cwd(), 'google-service-account.json');
    if (existsSync(keyFilePath)) {
      const parsed = JSON.parse(readFileSync(keyFilePath, 'utf-8')) as ServiceAccountCredentials;
      return { client_email: parsed.client_email, private_key: parsed.private_key };
    }

    // Hosted deploy (Render): no key file ever gets committed/deployed,
    // so these come from env vars set directly in Render's dashboard
    // instead — copy client_email/private_key out of the same JSON file.
    const email = this.config.get<string>('GOOGLE_SHEETS_CLIENT_EMAIL');
    const key = this.config.get<string>('GOOGLE_SHEETS_PRIVATE_KEY');
    if (email && key) {
      // Env var textboxes can't hold a literal newline — the private key
      // has to be pasted with "\n" escape sequences, which need
      // converting back to real newlines before the JWT client can use it.
      return { client_email: email, private_key: key.replace(/\\n/g, '\n') };
    }
    return null;
  }

  /**
   * Creates the tab if it doesn't exist yet, then **always** syncs row 1
   * to the current header — using `update` (overwrite that one row),
   * not `append` (which would stack a second header row below the
   * first). This matters whenever a header changes after a tab already
   * has data in it (e.g. adding a column) — without this, old rows
   * would silently drift out of alignment with a header that no longer
   * describes them. Only runs once per tab per process lifetime
   * (`knownTabs`), not on every single row write.
   */
  private async ensureTab(title: string, headerRow: (string | number)[]): Promise<void> {
    if (this.knownTabs.has(title)) return;
    if (!this.sheets || !this.spreadsheetId) return;

    const spreadsheet = await this.sheets.spreadsheets.get({ spreadsheetId: this.spreadsheetId });
    const exists = spreadsheet.data.sheets?.some((s) => s.properties?.title === title);

    if (!exists) {
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: { requests: [{ addSheet: { properties: { title } } }] },
      });
    }

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `${title}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [headerRow] },
    });
    this.knownTabs.add(title);
  }

  /**
   * Appends rows to the given tab, creating the tab with `headerRow` as
   * its first row the first time anything is written to it. Never
   * throws — failures are logged, not propagated, per this class's
   * "optional, non-blocking" design (see class doc comment).
   */
  async appendRows(tabTitle: string, headerRow: (string | number)[], rows: (string | number)[][]): Promise<void> {
    if (!this.sheets || !this.spreadsheetId || rows.length === 0) return;
    try {
      await this.ensureTab(tabTitle, headerRow);
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: `${tabTitle}!A1`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: rows },
      });
    } catch (error) {
      this.logger.error(`Failed to append to Google Sheet tab "${tabTitle}"`, error as Error);
    }
  }

  async appendRow(tabTitle: string, headerRow: (string | number)[], row: (string | number)[]): Promise<void> {
    await this.appendRows(tabTitle, headerRow, [row]);
  }
}
