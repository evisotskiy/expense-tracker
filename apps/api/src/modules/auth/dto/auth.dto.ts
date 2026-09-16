import { loginSchema, registerSchema } from '@expense-tracker/shared';
import { createZodDto } from 'nestjs-zod';

/**
 * createZodDto превращает Zod-схему в класс, который Nest умеет использовать
 * и как тип параметра @Body(), и как источник схемы для Swagger.
 *
 * Схемы живут в packages/shared, поэтому одна и та же валидация работает
 * и на бэкенде, и в формах фронтенда.
 */
export class RegisterDto extends createZodDto(registerSchema) {}

export class LoginDto extends createZodDto(loginSchema) {}
