import { loginSchema } from '@expense-tracker/shared';
import type { z } from 'zod';

// Реэкспорт из shared, а не собственная копия — одна точка правды, если
// завтра появится поле «запомнить меня».
export { loginSchema };

export type LoginFormValues = z.input<typeof loginSchema>;
export type LoginFormData = z.output<typeof loginSchema>;
