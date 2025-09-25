import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function levelFromXP(totalXP: number) {
	const t = Math.max(0, totalXP);                // no floor here
	// invert quadratic: totalXP = 25L^2 + 75L  (for level boundary)
	const x = (-75 + Math.sqrt(5625 + 100 * t)) / 50;
	const level = Math.floor(x) + 1;               // level stays integer

	const xpStart = 25 * (level - 1) * (level - 1) + 75 * (level - 1);
	const xpEnd = 25 * level * level + 75 * level;

	const experience = t - xpStart;             // keep fractional
	const maxExperience = xpEnd - xpStart;         // 50*level + 50

	return { level, experience, maxExperience, xpStart, xpEnd };
}
