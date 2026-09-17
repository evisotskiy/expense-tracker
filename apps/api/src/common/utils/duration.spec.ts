import { isDuration, parseDurationToSeconds } from './duration';

describe('parseDurationToSeconds', () => {
  it.each([
    ['15m', 900],
    ['30d', 2_592_000],
    ['2h', 7_200],
    ['900', 900],
    ['0s', 0],
    ['1s', 1],
  ])('переводит "%s" в %d секунд', (input, expected) => {
    expect(parseDurationToSeconds(input)).toBe(expected);
  });

  it.each(['1.5h', '15min', '', 'abc', '-5m', '5 m', '15M'])(
    'бросает на некорректном формате "%s"',
    (input) => {
      expect(() => parseDurationToSeconds(input)).toThrow();
    },
  );
});

describe('isDuration', () => {
  it.each(['15m', '30d', '2h', '900', '0s'])('true для "%s"', (input) => {
    expect(isDuration(input)).toBe(true);
  });

  it.each(['1.5h', '15min', '', 'abc', '-5m'])('false для "%s"', (input) => {
    expect(isDuration(input)).toBe(false);
  });
});
