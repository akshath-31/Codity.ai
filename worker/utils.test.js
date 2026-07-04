const { calculateBackoff } = require('./utils');

describe('calculateBackoff', () => {
  it('returns the base delay for fixed strategy regardless of attempt number', () => {
    const policy = { strategy: 'fixed', base_delay_seconds: 30, max_delay_seconds: 300 };

    expect(calculateBackoff(policy, 1)).toBe(30);
    expect(calculateBackoff(policy, 3)).toBe(30);
    expect(calculateBackoff(policy, 10)).toBe(30);
  });

  it('returns base_delay_seconds * attemptNumber for the linear strategy', () => {
    const policy = { strategy: 'linear', base_delay_seconds: 15, max_delay_seconds: 300 };

    expect(calculateBackoff(policy, 2)).toBe(30);
    expect(calculateBackoff(policy, 5)).toBe(75);
  });

  it('returns base_delay_seconds * 2^(attemptNumber-1) for the exponential strategy', () => {
    const policy = { strategy: 'exponential', base_delay_seconds: 10, max_delay_seconds: 300 };

    expect(calculateBackoff(policy, 1)).toBe(10);
    expect(calculateBackoff(policy, 3)).toBe(40);
    expect(calculateBackoff(policy, 5)).toBe(160);
  });

  it('caps all strategies at max_delay_seconds', () => {
    const fixedPolicy = { strategy: 'fixed', base_delay_seconds: 200, max_delay_seconds: 120 };
    const linearPolicy = { strategy: 'linear', base_delay_seconds: 200, max_delay_seconds: 120 };
    const exponentialPolicy = { strategy: 'exponential', base_delay_seconds: 200, max_delay_seconds: 120 };

    expect(calculateBackoff(fixedPolicy, 20)).toBe(120);
    expect(calculateBackoff(linearPolicy, 20)).toBe(120);
    expect(calculateBackoff(exponentialPolicy, 20)).toBe(120);
  });
});
