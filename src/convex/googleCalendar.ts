import { v } from "convex/values";
import { mutation, query, action, internalMutation, internalQuery, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

// ============================================================================
// Error Classification & Retry Configuration
// ============================================================================

type ErrorCode =
    | 'TOKEN_EXPIRED'
    | 'RATE_LIMITED'
    | 'INVALID_GRANT'
    | 'API_ERROR'
    | 'NETWORK_ERROR'
    | 'UNKNOWN';

interface ClassifiedError {
    code: ErrorCode;
    message: string;
    httpStatus?: number;
    retryable: boolean;
}

const RETRY_CONFIG = {
    MAX_ATTEMPTS: 5,
    BASE_DELAY_MS: 60_000,      // 1 minute
    BACKOFF_MULTIPLIER: 2,      // 1min → 2min → 4min → 8min → 16min
};

const RATE_LIMIT_CONFIG = {
    MAX_PER_USER_PER_RUN: 5,
    STAGGER_DELAY_MS: 500,
    JITTER_MAX_MS: 200,
};

function classifyError(error: unknown, httpStatus?: number): ClassifiedError {
    const message = error instanceof Error ? error.message : String(error);

    // Check HTTP status codes
    if (httpStatus === 401) {
        return { code: 'TOKEN_EXPIRED', message, httpStatus, retryable: true };
    }
    if (httpStatus === 429) {
        return { code: 'RATE_LIMITED', message, httpStatus, retryable: true };
    }
    if (httpStatus === 403) {
        // Check if it's an invalid grant (revoked token)
        if (message.toLowerCase().includes('invalid_grant') ||
            message.toLowerCase().includes('revoked') ||
            message.toLowerCase().includes('access_denied')) {
            return { code: 'INVALID_GRANT', message, httpStatus, retryable: false };
        }
        return { code: 'API_ERROR', message, httpStatus, retryable: true };
    }
    if (httpStatus && httpStatus >= 500) {
        return { code: 'API_ERROR', message, httpStatus, retryable: true };
    }

    // Check error message patterns
    if (message.toLowerCase().includes('network') ||
        message.toLowerCase().includes('fetch') ||
        message.toLowerCase().includes('econnrefused')) {
        return { code: 'NETWORK_ERROR', message, retryable: true };
    }
    if (message.toLowerCase().includes('token') &&
        (message.toLowerCase().includes('expired') || message.toLowerCase().includes('invalid'))) {
        return { code: 'TOKEN_EXPIRED', message, retryable: true };
    }

    return { code: 'UNKNOWN', message, httpStatus, retryable: true };
}

function calculateNextRetryDelay(attempt: number): number {
    // Exponential backoff: BASE * MULTIPLIER^(attempt-1)
    const delay = RETRY_CONFIG.BASE_DELAY_MS * Math.pow(RETRY_CONFIG.BACKOFF_MULTIPLIER, attempt - 1);
    // Add jitter (0-10% of delay)
    const jitter = Math.random() * delay * 0.1;
    return Math.floor(delay + jitter);
}

// ============================================================================
// Google Calendar Connection Management
// ============================================================================

// Store Google Calendar OAuth tokens
export const storeConnection = mutation({
    args: {
        accessToken: v.string(),
        refreshToken: v.string(),
        expiresAt: v.number(),
        calendarId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user) {
            throw new Error("User not found");
        }

        // Check if connection already exists
        const existingConnection = await ctx.db
            .query("google_calendar_connections")
            .withIndex("by_user_id", (q) => q.eq("userId", user._id))
            .first();

        const now = Date.now();

        if (existingConnection) {
            // Update existing connection
            await ctx.db.patch(existingConnection._id, {
                accessToken: args.accessToken,
                refreshToken: args.refreshToken,
                expiresAt: args.expiresAt,
                ...(args.calendarId && { calendarId: args.calendarId }),
                updatedAt: now,
            });
            return existingConnection._id;
        } else {
            // Create new connection
            return await ctx.db.insert("google_calendar_connections", {
                userId: user._id,
                accessToken: args.accessToken,
                refreshToken: args.refreshToken,
                expiresAt: args.expiresAt,
                calendarId: args.calendarId ?? "primary",
                syncEnabled: true,
                createdAt: now,
                updatedAt: now,
            });
        }
    },
});

// Get current user's Google Calendar connection status
export const getConnectionStatus = query({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return { connected: false };
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user) {
            return { connected: false };
        }

        const connection = await ctx.db
            .query("google_calendar_connections")
            .withIndex("by_user_id", (q) => q.eq("userId", user._id))
            .first();

        if (!connection) {
            return { connected: false };
        }

        return {
            connected: true,
            syncEnabled: connection.syncEnabled,
            calendarId: connection.calendarId,
            expiresAt: connection.expiresAt,
            isExpired: connection.expiresAt < Date.now(),
        };
    },
});

// Disconnect Google Calendar
export const disconnect = mutation({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user) {
            throw new Error("User not found");
        }

        const connection = await ctx.db
            .query("google_calendar_connections")
            .withIndex("by_user_id", (q) => q.eq("userId", user._id))
            .first();

        if (connection) {
            await ctx.db.delete(connection._id);
        }

        return { success: true };
    },
});

// Toggle sync enabled
export const toggleSync = mutation({
    args: {
        enabled: v.boolean(),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user) {
            throw new Error("User not found");
        }

        const connection = await ctx.db
            .query("google_calendar_connections")
            .withIndex("by_user_id", (q) => q.eq("userId", user._id))
            .first();

        if (!connection) {
            throw new Error("No Google Calendar connection found");
        }

        await ctx.db.patch(connection._id, {
            syncEnabled: args.enabled,
            updatedAt: Date.now(),
        });

        return { success: true };
    },
});

// ============================================================================
// Google Calendar API Actions
// ============================================================================

// Create a Google Calendar event for a scheduled post
export const createCalendarEvent = action({
    args: {
        postId: v.id("generated_posts"),
    },
    handler: async (ctx, args) => {
        // Get the post
        const post = await ctx.runQuery(internal.googleCalendar.getPostForSync, {
            postId: args.postId,
        });

        if (!post) {
            throw new Error("Post not found or not scheduled");
        }

        // Get user's Google Calendar connection
        let connection = await ctx.runQuery(internal.googleCalendar.getConnectionForUser, {
            userId: post.userId,
        });

        if (!connection || !connection.syncEnabled) {
            throw new Error("Google Calendar not connected or sync disabled");
        }

        // Check if token is expired (with 5 min buffer)
        let accessToken = connection.accessToken;
        if (connection.expiresAt < Date.now() + 5 * 60 * 1000) {
            // Attempt token refresh
            if (!connection.refreshToken) {
                throw new Error("Google Calendar token expired and no refresh token available. Please reconnect.");
            }

            try {
                const refreshResult = await ctx.runAction(internal.googleCalendar.refreshAccessToken, {
                    userId: post.userId,
                });
                accessToken = refreshResult.accessToken;
            } catch (refreshError) {
                throw new Error("Google Calendar token expired and refresh failed. Please reconnect.");
            }
        }

        // Create the event via Google Calendar API
        const event = {
            summary: `Postar no Instagram${post.projectName ? ` - ${post.projectName}` : ''}`,
            description: post.caption,
            start: {
                dateTime: new Date(post.scheduledFor!).toISOString(),
                timeZone: 'America/Sao_Paulo',
            },
            end: {
                dateTime: new Date(post.scheduledFor! + 60 * 60 * 1000).toISOString(), // 1 hour duration
                timeZone: 'America/Sao_Paulo',
            },
            reminders: post.reminderMinutes ? {
                useDefault: false,
                overrides: [
                    { method: 'popup', minutes: post.reminderMinutes },
                ],
            } : {
                useDefault: true,
            },
        };

        try {
            const response = await fetch(
                `https://www.googleapis.com/calendar/v3/calendars/${connection.calendarId}/events`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(event),
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(`Google Calendar API error: ${error.error?.message || 'Unknown error'}`);
            }

            const createdEvent = await response.json();

            // Update calendar_events with Google event ID
            await ctx.runMutation(internal.googleCalendar.updateCalendarEventWithGoogleId, {
                postId: args.postId,
                googleEventId: createdEvent.id,
            });

            return { success: true, googleEventId: createdEvent.id };
        } catch (error) {
            console.error('Failed to create Google Calendar event:', error);
            throw error;
        }
    },
});

// Delete a Google Calendar event
export const deleteCalendarEvent = action({
    args: {
        postId: v.id("generated_posts"),
    },
    handler: async (ctx, args) => {
        // Get the calendar event
        const calendarEvent = await ctx.runQuery(internal.googleCalendar.getCalendarEventForPost, {
            postId: args.postId,
        });

        if (!calendarEvent || !calendarEvent.googleEventId) {
            return { success: true }; // Nothing to delete
        }

        // Get post to get userId
        const post = await ctx.runQuery(internal.googleCalendar.getPostForSync, {
            postId: args.postId,
        });

        if (!post) {
            return { success: true };
        }

        // Get connection
        const connection = await ctx.runQuery(internal.googleCalendar.getConnectionForUser, {
            userId: post.userId,
        });

        if (!connection) {
            return { success: true };
        }

        try {
            const response = await fetch(
                `https://www.googleapis.com/calendar/v3/calendars/${connection.calendarId}/events/${calendarEvent.googleEventId}`,
                {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${connection.accessToken}`,
                    },
                }
            );

            // 404 is OK - event might have been manually deleted
            if (!response.ok && response.status !== 404) {
                const error = await response.json();
                throw new Error(`Google Calendar API error: ${error.error?.message || 'Unknown error'}`);
            }

            return { success: true };
        } catch (error) {
            console.error('Failed to delete Google Calendar event:', error);
            throw error;
        }
    },
});

// ============================================================================
// Internal Queries/Mutations (for use by actions)
// ============================================================================

export const getPostForSync = internalQuery({
    args: {
        postId: v.id("generated_posts"),
    },
    handler: async (ctx, args) => {
        const post = await ctx.db.get(args.postId);
        if (!post || !post.scheduledFor || !post.userId) {
            return null;
        }

        // Get project name if available
        let projectName: string | undefined;
        if (post.projectId) {
            const project = await ctx.db.get(post.projectId);
            projectName = project?.name;
        }

        return {
            ...post,
            projectName,
        };
    },
});

export const getConnectionForUser = internalQuery({
    args: {
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("google_calendar_connections")
            .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
            .first();
    },
});

export const getCalendarEventForPost = internalQuery({
    args: {
        postId: v.id("generated_posts"),
    },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("calendar_events")
            .withIndex("by_post_id", (q) => q.eq("postId", args.postId))
            .first();
    },
});

export const updateCalendarEventWithGoogleId = internalMutation({
    args: {
        postId: v.id("generated_posts"),
        googleEventId: v.string(),
    },
    handler: async (ctx, args) => {
        const calendarEvent = await ctx.db
            .query("calendar_events")
            .withIndex("by_post_id", (q) => q.eq("postId", args.postId))
            .first();

        if (calendarEvent) {
            await ctx.db.patch(calendarEvent._id, {
                googleEventId: args.googleEventId,
                status: "synced",
                lastSyncAt: Date.now(),
                updatedAt: Date.now(),
            });
        }
    },
});

// ============================================================================
// Token Refresh
// ============================================================================

export const refreshAccessToken = internalAction({
    args: {
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        const connection = await ctx.runQuery(internal.googleCalendar.getConnectionForUser, {
            userId: args.userId,
        });

        if (!connection || !connection.refreshToken) {
            throw new Error("No refresh token available");
        }

        // Get credentials from environment
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
            throw new Error("Google OAuth credentials not configured");
        }

        const response = await fetch(GOOGLE_TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                refresh_token: connection.refreshToken,
                grant_type: 'refresh_token',
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Token refresh failed:', errorData);
            throw new Error('Failed to refresh token');
        }

        const data = await response.json();

        // Update stored tokens
        await ctx.runMutation(internal.googleCalendar.updateTokens, {
            userId: args.userId,
            accessToken: data.access_token,
            expiresAt: Date.now() + (data.expires_in * 1000),
        });

        return { accessToken: data.access_token };
    },
});

export const updateTokens = internalMutation({
    args: {
        userId: v.id("users"),
        accessToken: v.string(),
        expiresAt: v.number(),
    },
    handler: async (ctx, args) => {
        const connection = await ctx.db
            .query("google_calendar_connections")
            .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
            .first();

        if (connection) {
            await ctx.db.patch(connection._id, {
                accessToken: args.accessToken,
                expiresAt: args.expiresAt,
                updatedAt: Date.now(),
            });
        }
    },
});

// ============================================================================
// Background Sync (for cron job)
// ============================================================================

// Sync all pending calendar events with rate limiting and backoff respect
export const syncPendingEvents = internalMutation({
    args: {},
    handler: async (ctx) => {
        const now = Date.now();

        // Query all calendar_events with status "pending"
        const pendingEvents = await ctx.db
            .query("calendar_events")
            .withIndex("by_status", (q) => q.eq("status", "pending"))
            .collect();

        // Filter events that are ready to sync (not in backoff period)
        const readyEvents = pendingEvents.filter(event => {
            // If no nextRetryAt set, it's ready
            if (!event.nextRetryAt) return true;
            // If nextRetryAt is in the past, it's ready
            return event.nextRetryAt <= now;
        });

        // Group events by user for rate limiting
        const eventsByUser = new Map<string, typeof readyEvents>();
        for (const event of readyEvents) {
            const userId = event.userId.toString();
            if (!eventsByUser.has(userId)) {
                eventsByUser.set(userId, []);
            }
            eventsByUser.get(userId)!.push(event);
        }

        let scheduledCount = 0;
        let skippedBackoff = pendingEvents.length - readyEvents.length;
        let skippedRateLimit = 0;

        // Process each user's events with rate limiting
        for (const [, userEvents] of eventsByUser) {
            // Limit events per user per run
            const eventsToProcess = userEvents.slice(0, RATE_LIMIT_CONFIG.MAX_PER_USER_PER_RUN);
            skippedRateLimit += userEvents.length - eventsToProcess.length;

            for (let i = 0; i < eventsToProcess.length; i++) {
                const event = eventsToProcess[i];

                // Check if user has Google Calendar connected
                const connection = await ctx.db
                    .query("google_calendar_connections")
                    .withIndex("by_user_id", (q) => q.eq("userId", event.userId))
                    .first();

                // Only schedule sync if user has active connection
                if (connection && connection.syncEnabled) {
                    // Add staggered delay with jitter
                    const staggerDelay = i * RATE_LIMIT_CONFIG.STAGGER_DELAY_MS;
                    const jitter = Math.floor(Math.random() * RATE_LIMIT_CONFIG.JITTER_MAX_MS);
                    const totalDelay = staggerDelay + jitter;

                    await ctx.scheduler.runAfter(totalDelay, internal.googleCalendar.syncSingleEvent, {
                        eventId: event._id,
                        postId: event.postId,
                    });
                    scheduledCount++;
                }
            }
        }

        return {
            scheduledCount,
            totalPending: pendingEvents.length,
            skippedBackoff,
            skippedRateLimit,
        };
    },
});

// Sync a single calendar event with error handling and retry logic
export const syncSingleEvent = internalAction({
    args: {
        eventId: v.id("calendar_events"),
        postId: v.id("generated_posts"),
    },
    handler: async (ctx, args) => {
        // Get the calendar event for retry tracking
        const calendarEvent = await ctx.runQuery(internal.googleCalendar.getCalendarEvent, {
            eventId: args.eventId,
        });

        if (!calendarEvent) {
            console.error(`Calendar event ${args.eventId} not found`);
            return { success: false, error: 'Event not found' };
        }

        const currentAttempt = (calendarEvent.syncAttempts ?? 0) + 1;

        try {
            // Use the existing createCalendarEvent action
            await ctx.runAction(internal.googleCalendar.createCalendarEventInternal, {
                postId: args.postId,
            });

            // Mark sync as successful (resets retry state)
            await ctx.runMutation(internal.googleCalendar.markSyncSuccess, {
                eventId: args.eventId,
            });

            return { success: true };
        } catch (error) {
            // Extract HTTP status if available from error message
            let httpStatus: number | undefined;
            const statusMatch = String(error).match(/status[:\s]+(\d{3})/i);
            if (statusMatch) {
                httpStatus = parseInt(statusMatch[1], 10);
            }

            // Classify the error
            const classified = classifyError(error, httpStatus);

            console.error(`Sync failed for event ${args.eventId} (attempt ${currentAttempt}):`, {
                code: classified.code,
                message: classified.message,
                retryable: classified.retryable,
            });

            // Log error to sync_errors table
            await ctx.runMutation(internal.googleCalendar.logSyncError, {
                eventId: args.eventId,
                postId: args.postId,
                userId: calendarEvent.userId,
                errorCode: classified.code,
                errorMessage: classified.message,
                httpStatus: classified.httpStatus,
                retryable: classified.retryable,
                syncAttempt: currentAttempt,
            });

            // Decide whether to retry or mark as failed
            if (classified.retryable && currentAttempt < RETRY_CONFIG.MAX_ATTEMPTS) {
                // Schedule retry with exponential backoff
                const retryDelay = calculateNextRetryDelay(currentAttempt);
                await ctx.runMutation(internal.googleCalendar.scheduleRetry, {
                    eventId: args.eventId,
                    attempt: currentAttempt,
                    nextRetryAt: Date.now() + retryDelay,
                    lastErrorCode: classified.code,
                });

                console.log(`Scheduled retry ${currentAttempt + 1} for event ${args.eventId} in ${retryDelay}ms`);
            } else {
                // Mark as permanently failed
                await ctx.runMutation(internal.googleCalendar.markSyncFailed, {
                    eventId: args.eventId,
                    lastErrorCode: classified.code,
                    attempt: currentAttempt,
                });

                console.error(`Event ${args.eventId} marked as sync_failed after ${currentAttempt} attempts`);
            }

            return { success: false, error: classified.message, code: classified.code };
        }
    },
});

// Internal version of createCalendarEvent for background sync
export const createCalendarEventInternal = internalAction({
    args: {
        postId: v.id("generated_posts"),
    },
    handler: async (ctx, args) => {
        // Get the post
        const post = await ctx.runQuery(internal.googleCalendar.getPostForSync, {
            postId: args.postId,
        });

        if (!post) {
            throw new Error("Post not found or not scheduled");
        }

        // Get user's Google Calendar connection
        const connection = await ctx.runQuery(internal.googleCalendar.getConnectionForUser, {
            userId: post.userId,
        });

        if (!connection || !connection.syncEnabled) {
            throw new Error("Google Calendar not connected or sync disabled");
        }

        // Check if token is expired (with 5 min buffer)
        let accessToken = connection.accessToken;
        if (connection.expiresAt < Date.now() + 5 * 60 * 1000) {
            if (!connection.refreshToken) {
                throw new Error("Token expired and no refresh token");
            }

            try {
                const refreshResult = await ctx.runAction(internal.googleCalendar.refreshAccessToken, {
                    userId: post.userId,
                });
                accessToken = refreshResult.accessToken;
            } catch {
                throw new Error("Token refresh failed");
            }
        }

        // Create the event via Google Calendar API
        const event = {
            summary: `Postar no Instagram${post.projectName ? ` - ${post.projectName}` : ''}`,
            description: post.caption,
            start: {
                dateTime: new Date(post.scheduledFor!).toISOString(),
                timeZone: 'America/Sao_Paulo',
            },
            end: {
                dateTime: new Date(post.scheduledFor! + 60 * 60 * 1000).toISOString(),
                timeZone: 'America/Sao_Paulo',
            },
            reminders: post.reminderMinutes ? {
                useDefault: false,
                overrides: [
                    { method: 'popup', minutes: post.reminderMinutes },
                ],
            } : {
                useDefault: true,
            },
        };

        const response = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${connection.calendarId}/events`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(event),
            }
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Google Calendar API error: ${error.error?.message || 'Unknown error'}`);
        }

        const createdEvent = await response.json();

        // Update calendar_events with Google event ID
        await ctx.runMutation(internal.googleCalendar.updateCalendarEventWithGoogleId, {
            postId: args.postId,
            googleEventId: createdEvent.id,
        });

        return { success: true, googleEventId: createdEvent.id };
    },
});

// ============================================================================
// Error Tracking & Retry Management
// ============================================================================

// Get a calendar event by ID
export const getCalendarEvent = internalQuery({
    args: {
        eventId: v.id("calendar_events"),
    },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.eventId);
    },
});

// Log a sync error to the sync_errors table
export const logSyncError = internalMutation({
    args: {
        eventId: v.id("calendar_events"),
        postId: v.id("generated_posts"),
        userId: v.id("users"),
        errorCode: v.string(),
        errorMessage: v.string(),
        httpStatus: v.optional(v.number()),
        retryable: v.boolean(),
        syncAttempt: v.number(),
    },
    handler: async (ctx, args) => {
        await ctx.db.insert("sync_errors", {
            eventId: args.eventId,
            postId: args.postId,
            userId: args.userId,
            errorCode: args.errorCode,
            errorMessage: args.errorMessage,
            httpStatus: args.httpStatus,
            retryable: args.retryable,
            syncAttempt: args.syncAttempt,
            createdAt: Date.now(),
        });
    },
});

// Mark a sync as successful (reset retry state)
export const markSyncSuccess = internalMutation({
    args: {
        eventId: v.id("calendar_events"),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.eventId, {
            status: "synced",
            lastSyncAt: Date.now(),
            updatedAt: Date.now(),
            // Reset retry state
            syncAttempts: 0,
            nextRetryAt: undefined,
            lastErrorCode: undefined,
        });
    },
});

// Schedule a retry with exponential backoff
export const scheduleRetry = internalMutation({
    args: {
        eventId: v.id("calendar_events"),
        attempt: v.number(),
        nextRetryAt: v.number(),
        lastErrorCode: v.string(),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.eventId, {
            syncAttempts: args.attempt,
            nextRetryAt: args.nextRetryAt,
            lastErrorCode: args.lastErrorCode,
            updatedAt: Date.now(),
        });
    },
});

// Mark a sync as permanently failed
export const markSyncFailed = internalMutation({
    args: {
        eventId: v.id("calendar_events"),
        lastErrorCode: v.string(),
        attempt: v.number(),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.eventId, {
            status: "sync_failed",
            syncAttempts: args.attempt,
            lastErrorCode: args.lastErrorCode,
            nextRetryAt: undefined, // No more retries
            updatedAt: Date.now(),
        });
    },
});
