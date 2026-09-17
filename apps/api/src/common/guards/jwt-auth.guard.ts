import { Inject, Injectable, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Глобальный guard: по умолчанию закрыто всё, открывается декоратором @Public().
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  // @Inject(Reflector) — явный токен, а не только тип параметра. Reflector здесь
  // используется исключительно как тип, и при emitDecoratorMetadata с erased
  // (type-only) импортом design:paramtypes получил бы global Function вместо
  // класса Reflector — Nest не смог бы резолвить зависимость («Function» вместо
  // токена). @Inject снимает эту зависимость от реэкспорта типа в JS.
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    // getAllAndOverride: @Public() на методе перекрывает настройку контроллера
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    return isPublic ? true : super.canActivate(context);
  }
}
