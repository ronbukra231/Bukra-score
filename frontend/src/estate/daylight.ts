/**
 * Daylight — the estate's ambient light follows the investor's local time.
 * Subtle by design: only the hue and warmth of the overhead light change.
 * Morning gold, clear midday, warm evening, low night light.
 */
export interface Daylight {
  period: 'morning' | 'day' | 'evening' | 'night'
  ambient: string          // CSS background for the overhead light
  greetingEn: string
  greetingHe: string
}

export function daylight(now: Date = new Date()): Daylight {
  const h = now.getHours()
  if (h >= 5 && h < 12) return {
    period: 'morning',
    ambient: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(214,178,94,0.10), transparent)',
    greetingEn: 'Good morning', greetingHe: 'בוקר טוב',
  }
  if (h >= 12 && h < 17) return {
    period: 'day',
    ambient: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(201,181,140,0.07), transparent)',
    greetingEn: 'Good afternoon', greetingHe: 'צהריים טובים',
  }
  if (h >= 17 && h < 22) return {
    period: 'evening',
    ambient: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(196,138,66,0.09), transparent)',
    greetingEn: 'Good evening', greetingHe: 'ערב טוב',
  }
  return {
    period: 'night',
    ambient: 'radial-gradient(ellipse 80% 45% at 50% -10%, rgba(160,140,100,0.05), transparent)',
    greetingEn: 'Good evening', greetingHe: 'לילה טוב',
  }
}
