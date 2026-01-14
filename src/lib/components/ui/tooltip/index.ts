import { Tooltip as TooltipPrimitive } from "bits-ui";
import Tooltip from "./tooltip.svelte";
import TooltipTrigger from "./tooltip-trigger.svelte";
import TooltipContent from "./tooltip-content.svelte";

const TooltipProvider = TooltipPrimitive.Provider;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
