import type { RequestHandler } from '@sveltejs/kit';
import { redirect, isRedirect } from '@sveltejs/kit';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../../../convex/_generated/api.js';
import { PUBLIC_CONVEX_URL } from '$env/static/public';
import { env } from '$env/dynamic/private';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

export const GET: RequestHandler = async ({ url, locals }) => {
	const code = url.searchParams.get('code');
	const error = url.searchParams.get('error');

	// Handle OAuth errors from Google
	if (error) {
		console.error('Google OAuth error:', error);
		redirect(303, `/calendar?google_error=${encodeURIComponent(error)}`);
	}

	if (!code) {
		redirect(303, '/calendar?google_error=missing_code');
	}

	// Get the authenticated user from Clerk
	const auth = locals.auth();
	const token = await auth.getToken({ template: 'convex' });

	if (!token) {
		redirect(303, '/calendar?google_error=not_authenticated');
	}

	try {
		// Get client ID from environment
		const clientId = env.GOOGLE_CLIENT_ID;
		const clientSecret = env.GOOGLE_CLIENT_SECRET;
		if (!clientId || !clientSecret) {
			throw new Error('Google OAuth credentials not configured');
		}

		// Build redirect URI (must match what was used in the OAuth request)
		const redirectUri = `${url.origin}/api/auth/google/callback`;

		// Exchange authorization code for tokens
		const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: new URLSearchParams({
				client_id: clientId,
				client_secret: clientSecret,
				code,
				grant_type: 'authorization_code',
				redirect_uri: redirectUri,
			}),
		});

		if (!tokenResponse.ok) {
			const errorData = await tokenResponse.json();
			console.error('Token exchange failed:', errorData);
			throw new Error(errorData.error_description || 'Failed to exchange code for tokens');
		}

		const tokenData = await tokenResponse.json();
		const { access_token, refresh_token, expires_in } = tokenData;

		if (!access_token) {
			throw new Error('No access token received');
		}

		// Calculate expiration timestamp
		const expiresAt = Date.now() + (expires_in * 1000);

		// Store the connection in Convex
		const convexClient = new ConvexHttpClient(PUBLIC_CONVEX_URL);
		convexClient.setAuth(token);

		await convexClient.mutation(api.googleCalendar.storeConnection, {
			accessToken: access_token,
			refreshToken: refresh_token || '',
			expiresAt,
			calendarId: 'primary',
		});

		// Success - redirect to calendar page
		redirect(303, '/calendar?google_connected=true');
	} catch (err) {
		// Re-throw redirects (they're not actual errors)
		if (isRedirect(err)) {
			throw err;
		}
		console.error('Google Calendar connection failed:', err);
		const errorMessage = err instanceof Error ? err.message : 'Unknown error';
		redirect(303, `/calendar?google_error=${encodeURIComponent(errorMessage)}`);
	}
};
