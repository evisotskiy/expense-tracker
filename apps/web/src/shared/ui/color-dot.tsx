import { cn } from '@/shared/lib/cn';

interface ColorDotProps {
  color: string | null;
  className?: string;
}

/**
 * Цвет категории — произвольный HEX из БД, не литерал из темы: Tailwind JIT
 * собирает только классы, видимые как текст в исходниках, поэтому bg-[${color}]
 * не сработает. Inline style — единственный оправданный способ здесь.
 */
export function ColorDot({ color, className }: ColorDotProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-block size-2.5 shrink-0 rounded-full',
        !color && 'bg-muted-foreground/40',
        className,
      )}
      style={color ? { backgroundColor: color } : undefined}
    />
  );
}
