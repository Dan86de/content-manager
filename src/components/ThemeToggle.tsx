import { MoonIcon, SunIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "#/lib/utils.ts";

type Theme = "light" | "dark";

// Reads the theme already applied to <html> by the pre-paint script in the
// root document, so the button starts in sync with what the user sees.
function currentTheme(): Theme {
	if (typeof document === "undefined") return "dark";
	return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

// A single switcher between light and dark. Flips the `dark` class on <html>
// (which drives the CSS token sets in styles.css) and remembers the choice.
export function ThemeToggle({ className }: { className?: string }) {
	const [theme, setTheme] = useState<Theme>(currentTheme);

	useEffect(() => {
		const root = document.documentElement;
		root.classList.toggle("dark", theme === "dark");
		localStorage.setItem("theme", theme);
	}, [theme]);

	const next = theme === "dark" ? "light" : "dark";

	return (
		<button
			type="button"
			onClick={() => setTheme(next)}
			aria-label={`Switch to ${next} mode`}
			title={`Switch to ${next} mode`}
			className={cn(
				"inline-flex size-9 items-center justify-center rounded-md border border-border bg-secondary text-secondary-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
				className,
			)}
		>
			<SunIcon className="size-4.5 dark:hidden" />
			<MoonIcon className="hidden size-4.5 dark:block" />
		</button>
	);
}
