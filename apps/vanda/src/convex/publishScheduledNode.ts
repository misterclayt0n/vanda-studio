"use node";

import { v } from "convex/values";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { decryptInstagramToken } from "./instagramToken";
import { publishStoreLive, publisherLive } from "./pipeline/livePublish";
import { publishDue } from "./pipeline/publish";

/**
 * Scheduler target for a due scheduled post: resolve the account's Instagram
 * connection, decrypt its token, and run the publish program against the live
 * Graph API. The program records the outcome on the scheduled-post row.
 */
export const runScheduledPost = internalAction({
  args: { scheduledPostId: v.id("scheduledPosts") },
  handler: async (ctx, { scheduledPostId }) => {
    // The credential phase (connection lookup + token decrypt) runs before
    // publishDue, so its failures are recorded here; publishDue records its own
    // publish-phase failures. Either way the row never strands at "scheduled".
    let igUserId: string;
    let token: string;
    try {
      const connection = await ctx.runQuery(internal.publishScheduled.getPublishConnection, {
        scheduledPostId,
      });
      if (connection === null) throw new Error("no_connected_account");
      igUserId = connection.igUserId;
      token = decryptInstagramToken(connection);
    } catch (error) {
      await ctx.runMutation(internal.publishScheduled.setScheduledStatus, {
        scheduledPostId,
        status: "failed",
        lastError: error instanceof Error ? error.message : "credential_error",
      });
      return;
    }
    const layer = Layer.mergeAll(publishStoreLive(ctx), publisherLive({ igUserId, token }));
    await Effect.runPromise(publishDue(scheduledPostId).pipe(Effect.provide(layer)));
  },
});
