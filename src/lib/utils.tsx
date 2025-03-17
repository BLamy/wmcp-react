import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Combines multiple class names using clsx and merges Tailwind CSS classes with tailwind-merge
 * to handle conflicts and duplications properly.
 * 
 * @param inputs - Class values to be combined (strings, objects, arrays, etc.)
 * @returns A string of merged class names
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
