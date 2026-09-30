import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";
import { executeAutomation, type AutomationEnv } from "./runner";
import {
  resolveRuntimeConfiguration,
  type RuntimeConfigEnv,
} from "./runtime-config";
import { updateRun } from "./storage";

type AutomationWorkflowEnv = AutomationEnv & RuntimeConfigEnv;

export interface AutomationWorkflowParams {
  mode?: "manual" | "scheduled";
  runId?: string;
  triggeredAt?: string;
}

export class JobAutomationWorkflow extends WorkflowEntrypoint<
  AutomationWorkflowEnv,
  AutomationWorkflowParams
> {
  async run(
    event: WorkflowEvent<AutomationWorkflowParams>,
    step: WorkflowStep,
  ) {
    const trigger = await step.do("resolve trigger", async () => ({
      mode: event.payload?.mode ?? "scheduled",
      runId: event.payload?.runId,
      triggeredAt: event.payload?.triggeredAt ?? event.timestamp.toISOString(),
    }));

    const result = await step.do(
      "execute application automation",
      {
        retries: { limit: 0, delay: "1 second" },
        timeout: "30 minutes",
      },
      async () => {
        const runtime = await resolveRuntimeConfiguration(this.env);
        return executeAutomation(runtime.env, {
          mode: trigger.mode,
          runId: trigger.runId,
        });
      },
    );

    if (result.status !== "skipped") {
      await step.do("link workflow instance", async () => {
        await updateRun(this.env.DB, result.runId, {
          workflowInstanceId: event.instanceId,
        });
      });
    }

    return result;
  }
}
