<script lang="ts">
	import { Calendar as CalendarPrimitive, type WithoutChildrenOrChild } from "bits-ui";
	import { ChevronLeft, ChevronRight } from "lucide-svelte";
	import type { DateValue } from "@internationalized/date";
	import { cn } from "$lib/utils.js";

	type Props = WithoutChildrenOrChild<CalendarPrimitive.RootProps> & {
		class?: string;
	};

	let {
		class: className,
		weekdayFormat = "short",
		...restProps
	}: Props = $props();

	const weekdayLabels: Record<string, string> = {
		"Sun": "Dom",
		"Mon": "Seg",
		"Tue": "Ter",
		"Wed": "Qua",
		"Thu": "Qui",
		"Fri": "Sex",
		"Sat": "Sab",
	};
</script>

<CalendarPrimitive.Root
	{weekdayFormat}
	class={cn("p-3", className)}
	{...restProps}
>
	{#snippet children({ months, weekdays })}
		<CalendarPrimitive.Header class="relative flex w-full items-center justify-between pt-1">
			<CalendarPrimitive.PrevButton
				class="inline-flex size-8 items-center justify-center rounded-none border border-border bg-transparent hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
			>
				<ChevronLeft class="size-4" />
			</CalendarPrimitive.PrevButton>
			<CalendarPrimitive.Heading class="text-sm font-medium capitalize" />
			<CalendarPrimitive.NextButton
				class="inline-flex size-8 items-center justify-center rounded-none border border-border bg-transparent hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
			>
				<ChevronRight class="size-4" />
			</CalendarPrimitive.NextButton>
		</CalendarPrimitive.Header>
		<div class="mt-4 flex flex-col gap-y-4 sm:flex-row sm:gap-x-4 sm:gap-y-0">
			{#each months as month}
				<CalendarPrimitive.Grid class="w-full border-collapse space-y-1">
					<CalendarPrimitive.GridHead>
						<CalendarPrimitive.GridRow class="flex">
							{#each weekdays as weekday}
								<CalendarPrimitive.HeadCell
									class="w-9 rounded-none text-[0.8rem] font-normal text-muted-foreground"
								>
									{weekdayLabels[weekday] ?? weekday.slice(0, 3)}
								</CalendarPrimitive.HeadCell>
							{/each}
						</CalendarPrimitive.GridRow>
					</CalendarPrimitive.GridHead>
					<CalendarPrimitive.GridBody>
						{#each month.weeks as weekDates}
							<CalendarPrimitive.GridRow class="mt-2 flex w-full">
								{#each weekDates as date}
									<CalendarPrimitive.Cell {date} month={month.value} class="relative size-9 p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([data-selected])]:bg-primary/10 [&:has([data-selected][data-outside-month])]:bg-primary/5">
										<CalendarPrimitive.Day
											class="inline-flex size-9 items-center justify-center rounded-none p-0 text-sm font-normal hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 aria-selected:opacity-100 data-[disabled]:text-muted-foreground data-[outside-month]:pointer-events-none data-[outside-month]:text-muted-foreground data-[outside-month]:opacity-50 data-[selected]:bg-primary data-[selected]:text-primary-foreground data-[selected]:hover:bg-primary data-[selected]:focus:bg-primary data-[today]:border data-[today]:border-primary data-[today]:bg-transparent data-[today]:text-foreground data-[selected]:data-[today]:border-0"
										/>
									</CalendarPrimitive.Cell>
								{/each}
							</CalendarPrimitive.GridRow>
						{/each}
					</CalendarPrimitive.GridBody>
				</CalendarPrimitive.Grid>
			{/each}
		</div>
	{/snippet}
</CalendarPrimitive.Root>
