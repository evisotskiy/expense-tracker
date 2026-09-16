import { createBudgetSchema, updateBudgetSchema } from '@expense-tracker/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateBudgetDto extends createZodDto(createBudgetSchema) {}

export class UpdateBudgetDto extends createZodDto(updateBudgetSchema) {}
