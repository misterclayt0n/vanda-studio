import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

// ============================================================================
// ICS Calendar File Generation
// ============================================================================

export type ICSEvent = {
	title: string;
	description: string;
	startTime: number; // Unix timestamp
	endTime?: number | undefined; // Unix timestamp (defaults to 1 hour after start)
	reminderMinutes?: number | undefined;
};

// Format date to ICS format (YYYYMMDDTHHMMSSZ)
function formatICSDate(timestamp: number): string {
	const date = new Date(timestamp);
	return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

// Generate a unique ID for the event
function generateUID(): string {
	return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}@vanda.studio`;
}

// Escape special characters in ICS text
function escapeICSText(text: string): string {
	return text
		.replace(/\\/g, '\\\\')
		.replace(/;/g, '\\;')
		.replace(/,/g, '\\,')
		.replace(/\n/g, '\\n');
}

// Generate ICS file content for a single event
export function generateICS(event: ICSEvent): string {
	const startTime = formatICSDate(event.startTime);
	const endTime = formatICSDate(event.endTime ?? event.startTime + 60 * 60 * 1000); // Default 1 hour
	const uid = generateUID();
	const now = formatICSDate(Date.now());

	let icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Vanda Studio//Post Scheduler//PT
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${now}
DTSTART:${startTime}
DTEND:${endTime}
SUMMARY:${escapeICSText(event.title)}
DESCRIPTION:${escapeICSText(event.description)}`;

	// Add reminder if specified
	if (event.reminderMinutes) {
		icsContent += `
BEGIN:VALARM
TRIGGER:-PT${event.reminderMinutes}M
ACTION:DISPLAY
DESCRIPTION:Lembrete: ${escapeICSText(event.title)}
END:VALARM`;
	}

	icsContent += `
END:VEVENT
END:VCALENDAR`;

	return icsContent;
}

// Generate ICS file content for multiple events
export function generateBulkICS(events: ICSEvent[]): string {
	const now = formatICSDate(Date.now());

	let icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Vanda Studio//Post Scheduler//PT
CALSCALE:GREGORIAN
METHOD:PUBLISH`;

	for (const event of events) {
		const startTime = formatICSDate(event.startTime);
		const endTime = formatICSDate(event.endTime ?? event.startTime + 60 * 60 * 1000);
		const uid = generateUID();

		icsContent += `
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${now}
DTSTART:${startTime}
DTEND:${endTime}
SUMMARY:${escapeICSText(event.title)}
DESCRIPTION:${escapeICSText(event.description)}`;

		if (event.reminderMinutes) {
			icsContent += `
BEGIN:VALARM
TRIGGER:-PT${event.reminderMinutes}M
ACTION:DISPLAY
DESCRIPTION:Lembrete: ${escapeICSText(event.title)}
END:VALARM`;
		}

		icsContent += `
END:VEVENT`;
	}

	icsContent += `
END:VCALENDAR`;

	return icsContent;
}
