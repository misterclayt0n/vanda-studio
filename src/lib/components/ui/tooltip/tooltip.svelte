<script lang="ts">
	import { Tooltip as TooltipPrimitive } from "bits-ui";

	let {
		delayDuration = 200,
		...rest
	}: TooltipPrimitive.RootProps = $props();
</script>

<TooltipPrimitive.Root {delayDuration} {...rest} />
