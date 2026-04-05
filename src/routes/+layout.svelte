<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
</script>

<div class="min-h-screen bg-slate-50 text-slate-900">
	<nav class="bg-white border-b border-slate-200">
		<!-- Colourful top accent stripe -->
		<div class="h-1 bg-gradient-to-r from-blue-500 via-violet-500 to-pink-500"></div>
		<div class="mx-auto max-w-5xl px-4">
			<div class="flex h-13 items-center gap-6">
				<span class="font-bold text-slate-900 tracking-tight">✈ sctracker</span>
				<a
					href="/"
					class="flex items-center h-full px-1 text-sm font-medium transition-colors hover:text-slate-900"
					class:text-slate-900={$page.url.pathname === '/'}
					class:text-slate-400={$page.url.pathname !== '/'}
					aria-current={$page.url.pathname === '/' ? 'page' : undefined}
				>Dashboard</a>
				<a
					href="/planner"
					class="flex items-center h-full px-1 text-sm font-medium transition-colors hover:text-slate-900"
					class:text-slate-900={$page.url.pathname === '/planner'}
					class:text-slate-400={$page.url.pathname !== '/planner'}
					aria-current={$page.url.pathname === '/planner' ? 'page' : undefined}
				>Planner</a>
				<a
					href="/settings"
					class="flex items-center h-full px-1 text-sm font-medium transition-colors hover:text-slate-900 ml-auto"
					class:text-slate-900={$page.url.pathname === '/settings'}
					class:text-slate-400={$page.url.pathname !== '/settings'}
					aria-current={$page.url.pathname === '/settings' ? 'page' : undefined}
				>Settings</a>
			</div>
		</div>
	</nav>

	<main class="mx-auto max-w-5xl px-4 py-8">
		<slot />
	</main>
</div>
