import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { ThemeToggle } from "../components/ThemeToggle";
import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";
import appCss from "../styles.css?url";

// Apply the saved theme to <html> before first paint to avoid a flash. Defaults
// to dark when nothing is stored. Runs as a blocking inline script in <head>.
const themeScript = `(()=>{try{const t=localStorage.getItem("theme");const dark=t?t==="dark":true;document.documentElement.classList.toggle("dark",dark);}catch{}})()`;

interface MyRouterContext {
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "TanStack Start Starter",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
		],
	}),
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" className="dark">
			<head>
				{/* biome-ignore lint/security/noDangerouslySetInnerHtml: tiny pre-paint theme script to avoid FOUC */}
				<script dangerouslySetInnerHTML={{ __html: themeScript }} />
				<HeadContent />
			</head>
			<body>
				<Navbar />
				{children}
				<TanStackDevtools
					config={{
						position: "bottom-right",
					}}
					plugins={[
						{
							name: "Tanstack Router",
							render: <TanStackRouterDevtoolsPanel />,
						},
						TanStackQueryDevtools,
					]}
				/>
				<Scripts />
			</body>
		</html>
	);
}

// Slim top bar across the layout. Tiled with CSS flex: brand on the left, the
// single light/dark switcher pushed to the right.
function Navbar() {
	return (
		<nav className="sticky top-0 z-10 border-border border-b bg-background/80 backdrop-blur">
			<div className="mx-auto flex max-w-5xl items-center justify-between px-8 py-3">
				<span className="font-semibold text-sm tracking-tight">
					Content Manager
				</span>
				<ThemeToggle />
			</div>
		</nav>
	);
}
