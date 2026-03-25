import { Hono } from 'hono';
import type { AppServices, AppMiddlewares } from './middleware.ts';

type DigestTask = {
  id: string;
  title: string;
  dueDate?: string;
  status?: string;
};

type DigestMeeting = {
  id: string;
  title: string;
  startsAt?: string;
};

function isoDateOnly(value: string | Date | undefined | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function isCompletedTask(task: DigestTask) {
  const status = String(task?.status || '').toLowerCase();
  return status === 'done' || status === 'completed' || status === 'closed';
}

function buildWorkspaceDigest(state: any, workspaceName = '') {
  const today = isoDateOnly(new Date());
  const nowTime = Date.now();
  const upcomingLimit = nowTime + 7 * 24 * 60 * 60 * 1000;
  const tasks = Array.isArray(state?.manualTasks) ? (state.manualTasks as DigestTask[]) : [];
  const meetings = Array.isArray(state?.meetings) ? (state.meetings as DigestMeeting[]) : [];

  const overdueTasks = tasks
    .filter(
      (task) =>
        !isCompletedTask(task) &&
        task.dueDate &&
        isoDateOnly(task.dueDate) &&
        isoDateOnly(task.dueDate) < today
    )
    .sort((left, right) => String(left.dueDate || '').localeCompare(String(right.dueDate || '')))
    .slice(0, 5);

  const todayTasks = tasks
    .filter((task) => !isCompletedTask(task) && isoDateOnly(task.dueDate) === today)
    .slice(0, 5);

  const upcomingMeetings = meetings
    .filter((meeting) => {
      const startsAt = new Date(meeting.startsAt || '').getTime();
      return Number.isFinite(startsAt) && startsAt >= nowTime && startsAt <= upcomingLimit;
    })
    .sort((left, right) => String(left.startsAt || '').localeCompare(String(right.startsAt || '')))
    .slice(0, 5);

  return {
    workspaceName,
    overdueTasks,
    todayTasks,
    upcomingMeetings,
    hasContent: overdueTasks.length > 0 || todayTasks.length > 0 || upcomingMeetings.length > 0,
  };
}

function renderDigestText(userName: string, digests: ReturnType<typeof buildWorkspaceDigest>[]) {
  const lines = [`Czesc ${userName || '!'}`, '', 'Oto Twoj dzienny digest:'];

  digests.forEach((digest) => {
    lines.push('');
    lines.push(digest.workspaceName ? `Workspace: ${digest.workspaceName}` : 'Workspace');
    lines.push(`- Zalegle zadania: ${digest.overdueTasks.length}`);
    digest.overdueTasks.forEach((task: DigestTask) =>
      lines.push(`  - ${task.title}${task.dueDate ? ` (${task.dueDate})` : ''}`)
    );
    lines.push(`- Zadania na dzis: ${digest.todayTasks.length}`);
    digest.todayTasks.forEach((task: DigestTask) => lines.push(`  - ${task.title}`));
    lines.push(`- Nadchodzace spotkania: ${digest.upcomingMeetings.length}`);
    digest.upcomingMeetings.forEach((meeting: DigestMeeting) =>
      lines.push(`  - ${meeting.title}${meeting.startsAt ? ` (${meeting.startsAt})` : ''}`)
    );
  });

  return lines.join('\n');
}

function renderDigestHtml(userName: string, digests: ReturnType<typeof buildWorkspaceDigest>[]) {
  const sections = digests
    .map(
      (digest) => `
      <section style="margin: 0 0 20px;">
        <h3 style="margin: 0 0 8px;">${digest.workspaceName || 'Workspace'}</h3>
        <p><strong>Zalegle zadania:</strong> ${digest.overdueTasks.length}</p>
        <ul>${digest.overdueTasks.map((task: DigestTask) => `<li>${task.title}${task.dueDate ? ` <small>${task.dueDate}</small>` : ''}</li>`).join('')}</ul>
        <p><strong>Zadania na dzis:</strong> ${digest.todayTasks.length}</p>
        <ul>${digest.todayTasks.map((task: DigestTask) => `<li>${task.title}</li>`).join('')}</ul>
        <p><strong>Nadchodzace spotkania:</strong> ${digest.upcomingMeetings.length}</p>
        <ul>${digest.upcomingMeetings.map((meeting: DigestMeeting) => `<li>${meeting.title}${meeting.startsAt ? ` <small>${meeting.startsAt}</small>` : ''}</li>`).join('')}</ul>
      </section>
    `
    )
    .join('');

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0f172a;">
      <h2 style="margin: 0 0 16px;">Dzienny digest${userName ? ` dla ${userName}` : ''}</h2>
      ${sections || '<p>Brak nowych zadan i spotkan.</p>'}
    </div>
  `;
}

async function buildMailer() {
  const host = String(process.env.VOICELOG_SMTP_HOST || '').trim();
  const user = String(process.env.VOICELOG_SMTP_USER || '').trim();
  const pass = String(process.env.VOICELOG_SMTP_PASS || '').trim();
  if (!host || !user || !pass) {
    return null;
  }

  const { createTransport } = await import('nodemailer');
  return createTransport({
    host,
    port: Number(process.env.VOICELOG_SMTP_PORT || 587),
    secure: String(process.env.VOICELOG_SMTP_SECURE || '').toLowerCase() === 'true',
    auth: { user, pass },
  });
}

export function createDigestRoutes(services: AppServices, middlewares: AppMiddlewares) {
  const router = new Hono();
  const { applyRateLimit } = middlewares;
  const workspaceService: any = services.workspaceService;
  const db = workspaceService?.db;

  router.get('/daily', applyRateLimit('digest-daily', 5), async (c) => {
    if (!db) {
      return c.json({ mode: 'no-db', sent: 0, skipped: 0, digests: [] }, 200);
    }

    const users = await db._query('SELECT * FROM users', []);
    const mailer = await buildMailer();
    const fromAddress = String(
      process.env.VOICELOG_SMTP_FROM || process.env.VOICELOG_SMTP_USER || 'no-reply@voicelog.local'
    ).trim();
    const previews: any[] = [];
    let sent = 0;
    let skipped = 0;

    for (const row of users || []) {
      const profile = (() => {
        try {
          return JSON.parse(String(row.profile_json || '{}'));
        } catch (_) {
          return {};
        }
      })();

      if (!Boolean(profile.notifyDailyDigest ?? true)) {
        skipped += 1;
        continue;
      }

      const accessibleWorkspaces = await db.accessibleWorkspaces(row.id);
      const digests = [];

      for (const workspace of accessibleWorkspaces || []) {
        const state = await workspaceService.getWorkspaceState(workspace.id);
        const digest = buildWorkspaceDigest(state, workspace.name);
        if (digest.hasContent) {
          digests.push(digest);
        }
      }

      if (!digests.length) {
        skipped += 1;
        continue;
      }

      const subject = `Dzienny digest - ${new Date().toLocaleDateString('pl-PL')}`;
      const text = renderDigestText(row.name || row.email || 'Uzytkownik', digests);
      const html = renderDigestHtml(row.name || row.email || 'Uzytkownik', digests);
      previews.push({ userId: row.id, email: row.email, subject, digestCount: digests.length });

      if (!mailer) {
        skipped += 1;
        continue;
      }

      await mailer.sendMail({
        from: fromAddress,
        to: row.email,
        subject,
        text,
        html,
      });
      sent += 1;
    }

    return c.json(
      {
        mode: mailer ? 'smtp' : 'preview',
        sent,
        skipped,
        digests: previews,
      },
      200
    );
  });

  return router;
}
