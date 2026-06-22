import { google, calendar_v3 } from "googleapis";
import { GoogleTokens } from "@/types";

const SCOPES = ["https://www.googleapis.com/auth/calendar.events"];
const SLOT_HOURS = [10, 14, 16]; // interview time slots (24h, recruiter local time)
const INTERVIEW_DURATION_MS = 60 * 60 * 1000; // 60 minutes
const MIN_NOTICE_MS = 48 * 60 * 60 * 1000;    // 48 hours from now

export function getOAuthClient(tokens?: GoogleTokens) {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  if (tokens) {
    client.setCredentials(tokens);
    // Transparently refresh the access token when it expires (SPEC §8.1)
    client.on("tokens", (refreshed) => {
      if (refreshed.refresh_token) {
        tokens.refresh_token = refreshed.refresh_token;
      }
      tokens.access_token = refreshed.access_token!;
      tokens.expiry_date = refreshed.expiry_date!;
    });
  }
  return client;
}

export function generateAuthUrl(): string {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent", // force refresh_token to be returned every time
  });
}

export async function exchangeCode(
  code: string
): Promise<GoogleTokens> {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  return tokens as GoogleTokens;
}

/**
 * Find the next available weekday slot at 10:00, 14:00, or 16:00 that:
 * - is at least 48 hours from now (SPEC §8.2)
 * - does not overlap any existing events
 */
export function findNextSlot(
  existingEvents: calendar_v3.Schema$TimePeriod[]
): Date {
  const earliest = new Date(Date.now() + MIN_NOTICE_MS);

  // Start from the next rounded hour at or after earliest
  const cursor = new Date(earliest);
  cursor.setMinutes(0, 0, 0);
  if (cursor < earliest) cursor.setHours(cursor.getHours() + 1);

  for (let day = 0; day < 30; day++) {
    const weekday = cursor.getDay();
    // Skip Saturday (6) and Sunday (0)
    if (weekday !== 0 && weekday !== 6) {
      for (const hour of SLOT_HOURS) {
        const slotStart = new Date(cursor);
        slotStart.setHours(hour, 0, 0, 0);

        if (slotStart < earliest) continue;

        const slotEnd = new Date(slotStart.getTime() + INTERVIEW_DURATION_MS);

        const conflicts = existingEvents.some((e) => {
          if (!e.start || !e.end) return false;
          const eStart = new Date(e.start);
          const eEnd = new Date(e.end);
          return slotStart < eEnd && slotEnd > eStart;
        });

        if (!conflicts) return slotStart;
      }
    }
    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(0, 0, 0, 0);
  }

  // Fallback: 48 hours from now (should never reach here in practice)
  return new Date(Date.now() + MIN_NOTICE_MS);
}

export async function createInterviewEvent({
  recruiterTokens,
  candidateEmail,
  recruiterEmail,
  job,
  claudeReasoning,
  preferredDateTime,
}: {
  recruiterTokens: GoogleTokens;
  candidateEmail: string;
  recruiterEmail: string;
  job: { title: string; positionId: string };
  claudeReasoning: string | null;
  preferredDateTime?: string; // ISO string; skips auto-find if provided
}): Promise<{ eventId: string; startTime: string }> {
  const auth = getOAuthClient(recruiterTokens);
  const calendar = google.calendar({ version: "v3", auth });

  let startTime: Date;

  if (preferredDateTime) {
    startTime = new Date(preferredDateTime);
  } else {
    // Fetch busy slots over the next 14 days to find a free slot
    const now = new Date();
    const twoWeeksOut = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const freeBusy = await calendar.freebusy.query({
      requestBody: {
        timeMin: now.toISOString(),
        timeMax: twoWeeksOut.toISOString(),
        items: [{ id: "primary" }],
      },
    });

    const busyPeriods = freeBusy.data.calendars?.primary?.busy ?? [];
    startTime = findNextSlot(busyPeriods);
  }

  const endTime = new Date(startTime.getTime() + INTERVIEW_DURATION_MS);

  const event = await calendar.events.insert({
    calendarId: "primary",
    sendUpdates: "all",
    requestBody: {
      summary: `Interview — ${candidateEmail} for ${job.title} (${job.positionId})`,
      description: claudeReasoning
        ? `AI Fit Reasoning:\n${claudeReasoning}`
        : "Interview scheduled via BestHire.",
      start: { dateTime: startTime.toISOString() },
      end: { dateTime: endTime.toISOString() },
      attendees: [
        { email: candidateEmail },
        { email: recruiterEmail },
      ],
      reminders: {
        useDefault: false,
        overrides: [
          { method: "email", minutes: 24 * 60 },
          { method: "popup", minutes: 30 },
        ],
      },
    },
  });

  return {
    eventId: event.data.id!,
    startTime: startTime.toISOString(),
  };
}

export async function cancelEvent(
  recruiterTokens: GoogleTokens,
  eventId: string
): Promise<void> {
  const auth = getOAuthClient(recruiterTokens);
  const calendar = google.calendar({ version: "v3", auth });
  await calendar.events.delete({
    calendarId: "primary",
    eventId,
    sendUpdates: "all",
  });
}
