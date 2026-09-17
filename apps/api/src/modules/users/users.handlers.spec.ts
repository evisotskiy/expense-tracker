import { CommandBus, CqrsModule, QueryBus } from '@nestjs/cqrs';
import { Test } from '@nestjs/testing';

import { CreateUserCommand } from './commands/create-user.command';
import { CreateUserHandler } from './commands/create-user.handler';
import { GetAuthUserQuery } from './queries/get-auth-user.query';
import { GetAuthUserHandler } from './queries/get-auth-user.handler';
import { GetUserCredentialsQuery } from './queries/get-user-credentials.query';
import { GetUserCredentialsHandler } from './queries/get-user-credentials.handler';
import { GetUserProfileQuery } from './queries/get-user-profile.query';
import { GetUserProfileHandler } from './queries/get-user-profile.handler';
import { type CreateUserData, UsersRepository } from './users.repository';

describe('Хендлеры users (unit)', () => {
  const repo = {
    create: jest.fn(),
    findAuthById: jest.fn(),
    findCredentialsByEmail: jest.fn(),
    findProfileById: jest.fn(),
  } as unknown as jest.Mocked<UsersRepository>;

  beforeEach(() => jest.resetAllMocks());

  it('CreateUserHandler делегирует в repository.create с распакованными полями команды', async () => {
    const handler = new CreateUserHandler(repo);
    const expected = { id: 'u1', email: 'a@b.c', name: null, baseCurrency: 'RUB' as const };
    repo.create.mockResolvedValue(expected);

    const result = await handler.execute(
      new CreateUserCommand('a@b.c', 'hash', 'Имя', 'RUB'),
    );

    expect(result).toBe(expected);
    expect(repo.create).toHaveBeenCalledWith({
      email: 'a@b.c',
      passwordHash: 'hash',
      name: 'Имя',
      baseCurrency: 'RUB',
    } satisfies CreateUserData);
  });

  it('GetUserCredentialsHandler делегирует в repository.findCredentialsByEmail', async () => {
    const handler = new GetUserCredentialsHandler(repo);
    repo.findCredentialsByEmail.mockResolvedValue(null);

    await handler.execute(new GetUserCredentialsQuery('a@b.c'));

    expect(repo.findCredentialsByEmail).toHaveBeenCalledWith('a@b.c');
  });

  it('GetAuthUserHandler делегирует в repository.findAuthById', async () => {
    const handler = new GetAuthUserHandler(repo);
    repo.findAuthById.mockResolvedValue(null);

    await handler.execute(new GetAuthUserQuery('u1'));

    expect(repo.findAuthById).toHaveBeenCalledWith('u1');
  });

  it('GetUserProfileHandler делегирует в repository.findProfileById', async () => {
    const handler = new GetUserProfileHandler(repo);
    repo.findProfileById.mockResolvedValue(null);

    await handler.execute(new GetUserProfileQuery('u1'));

    expect(repo.findProfileById).toHaveBeenCalledWith('u1');
  });
});

describe('Резолв CQRS-сообщений модуля users (проверка проводки)', () => {
  // Забытый хендлер в providers — не ошибка компиляции, а CommandHandlerNotFoundException/
  // QueryHandlerNotFoundException в рантайме (см. CQRS-раздел плана). Этот тест — замена
  // проверки типов, потерянной на границе шины: он ловит забытую регистрацию хендлера.
  it('каждая команда/запрос модуля users находит зарегистрированный хендлер', async () => {
    const repo = {
      create: jest.fn().mockResolvedValue({ id: 'u1', email: 'a@b.c', name: null, baseCurrency: 'RUB' }),
      findAuthById: jest.fn().mockResolvedValue(null),
      findCredentialsByEmail: jest.fn().mockResolvedValue(null),
      findProfileById: jest.fn().mockResolvedValue(null),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [CqrsModule.forRoot()],
      providers: [
        CreateUserHandler,
        GetUserCredentialsHandler,
        GetAuthUserHandler,
        GetUserProfileHandler,
        { provide: UsersRepository, useValue: repo },
      ],
    }).compile();

    // init() запускает onApplicationBootstrap, где CqrsModule регистрирует
    // хендлеры в CommandBus/QueryBus — без этого шага execute() всегда бросал бы
    // *NotFoundException независимо от того, зарегистрирован хендлер или нет.
    await moduleRef.init();

    const commandBus = moduleRef.get(CommandBus);
    const queryBus = moduleRef.get(QueryBus);

    await expect(commandBus.execute(new CreateUserCommand('a@b.c', 'hash'))).resolves.toEqual(
      expect.objectContaining({ id: 'u1' }),
    );
    await expect(queryBus.execute(new GetUserCredentialsQuery('a@b.c'))).resolves.toBeNull();
    await expect(queryBus.execute(new GetAuthUserQuery('u1'))).resolves.toBeNull();
    await expect(queryBus.execute(new GetUserProfileQuery('u1'))).resolves.toBeNull();

    await moduleRef.close();
  });
});
