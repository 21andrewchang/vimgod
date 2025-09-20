<script lang="ts">
	export type GoalKind = 'move' | 'highlight' | 'manipulate' | null;
	export type ManipulationAction = 'delete' | null;

	export let forceUndoRequired = false;
	export let targetKind: GoalKind = null;
	export let manipulationAction: ManipulationAction = null;

	const BASE_CLASS =
		'relative inline-flex items-center gap-3 overflow-hidden rounded-lg border border-neutral-400/20 bg-black/60 px-3 py-2 font-mono uppercase tracking-wide text-neutral-100';

	$: label = (() => {
		if (forceUndoRequired) return 'UNDO';
		if (targetKind === 'highlight') return 'SELECT';
		if (targetKind === 'move') return 'MOVE';
		if (targetKind === 'manipulate') {
			return manipulationAction === 'delete' ? 'DELETE' : 'MANIPULATE';
		}
		return 'READY';
	})();
</script>

<div class={BASE_CLASS}>
	<span class="text-md leading-none">{label}</span>
</div>
