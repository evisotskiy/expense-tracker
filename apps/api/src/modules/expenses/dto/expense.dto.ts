import {
  createExpenseSchema,
  expenseFiltersSchema,
  updateExpenseSchema,
} from '@expense-tracker/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateExpenseDto extends createZodDto(createExpenseSchema) {}

export class UpdateExpenseDto extends createZodDto(updateExpenseSchema) {}

export class ExpenseFiltersDto extends createZodDto(expenseFiltersSchema) {}
