<script lang="ts">
    import '../app.css';
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
  
    let { children } = $props();
  
    onMount(async () => {
      if (!browser) return;
  
      // If Font Loading API is missing, just show the logo.
      const fonts: FontFaceSet | undefined = (document as any).fonts;
      if (!fonts) {
        document.documentElement.classList.add('fonts-ready');
        return;
      }
  
      // If already loaded (cache), mark ready.
      if ((fonts as any).status === 'loaded') {
        document.documentElement.classList.add('fonts-ready');
        return;
      }
  
      // Wait briefly for your specific faces; don't block forever.
      await Promise.race([
        Promise.allSettled([
          fonts.load('500 24px "DM Mono"'),
          fonts.load('400 24px "Sono"')
        ]),
        new Promise((r) => setTimeout(r, 1500))
      ]);
  
      document.documentElement.classList.add('fonts-ready');
    });
  </script>
  
<svelte:head>
    <link rel="preload" href="/fonts/DMMono-500.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="/fonts/Sono-400.woff2"  as="font" type="font/woff2"  crossorigin>
</svelte:head>
  
<div class="app">
    {@render children()}  <!-- render the routed page here -->
</div>
  
<style>
    .app { min-height: 100vh; }
</style>