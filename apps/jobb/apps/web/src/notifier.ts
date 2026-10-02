export interface EmailBinding {
  send(message: {
    to: string;
    from: string;
    subject: string;
    text?: string;
    html?: string;
  }): Promise<{ messageId: string }>;
}

export interface NotificationEnv {
  EMAIL?: EmailBinding;
  NOTIFY_EMAIL_TO?: string;
  NOTIFY_EMAIL_FROM?: string;
  NOTIFY_WEBHOOK_URL?: string;
  PUBLIC_BASE_URL?: string;
}

export interface NotificationResult {
  channel: "email" | "webhook";
  status: "sent" | "failed";
  error?: string;
}

export async function notifyActivityReportActionRequired(
  env: NotificationEnv,
  runId: string,
): Promise<NotificationResult[]> {
  const dashboardUrl = env.PUBLIC_BASE_URL?.replace(/\/$/, "") ?? "";
  const results: NotificationResult[] = [];

  if (env.EMAIL && env.NOTIFY_EMAIL_TO && env.NOTIFY_EMAIL_FROM) {
    try {
      await env.EMAIL.send({
        to: env.NOTIFY_EMAIL_TO,
        from: env.NOTIFY_EMAIL_FROM,
        subject: "Jobb: aktivitetsrapporten behöver skickas in",
        text: [
          "Öppna Jobb-dashboarden på din egen enhet och fortsätt aktivitetsrapporten i din vanliga webbläsare.",
          dashboardUrl ? `Öppna dashboarden: ${dashboardUrl}` : "Öppna jobb-dashboarden.",
          "Logga in hos Arbetsförmedlingen med BankID i din egen webbläsare och skicka rapporten där.",
          `Körning: ${runId}`,
        ].join("\n"),
      });
      results.push({ channel: "email", status: "sent" });
    } catch (error) {
      results.push({
        channel: "email",
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (env.NOTIFY_WEBHOOK_URL) {
    try {
      const response = await fetch(env.NOTIFY_WEBHOOK_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          event: "activity_report_action_required",
          runId,
          dashboardUrl: dashboardUrl || undefined,
          message:
            "Aktivitetsrapporten behöver slutföras i användarens egen webbläsare.",
        }),
      });
      if (!response.ok) throw new Error(`Webhook returned HTTP ${response.status}`);
      results.push({ channel: "webhook", status: "sent" });
    } catch (error) {
      results.push({
        channel: "webhook",
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}
