<script lang="ts">
	export let url: string;
</script>

<main>
	<iframe src={url} title="iframe" />
</main>

<style>
	main {
		grid-area: main;
		display: grid;
		overflow: hidden;
	}

	iframe {
		width: 100%;
		height: 100%;
		border: none;
		display: block;
	}
</style>
