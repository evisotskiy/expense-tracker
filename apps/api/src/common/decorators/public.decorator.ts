import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Помечает маршрут как доступный без токена.
 *
 * Защита включена глобально (APP_GUARD в app.module.ts), поэтому безопаснее
 * открывать отдельные ручки явно, чем закрывать каждую по отдельности и забыть одну.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
